import prisma from '../prisma';

// Bypass TLS certificate check for local development
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

type BotStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR';

class BinanceBotService {
  private status: BotStatus = 'STOPPED';
  private ws: WebSocket | null = null;
  private config = { 
    timeframe: '5m', 
    smaPeriod: 20, 
    volumeMultiplier: 3.0, 
    minVolume: 10000.0, 
    minGreenCandles: 0, 
    minPriceChange: 0.0,
    totalCapital: 1000.0,
    tradeAmount: 100.0,
    trailingStopPct: 1.5
  };
  private volumeHistory: Record<string, number[]> = {};
  private activeSymbols: string[] = [];
  private pendingAlerts: Record<string, { count: number, price: number, prevVol: number, currVol: number, mult: number }> = {};
  private activePaperTrades: Record<string, any> = {};

  public getStatus(): BotStatus {
    return this.status;
  }

  public getMonitoredCount(): number {
    return this.activeSymbols.length;
  }

  public getConfig() {
    return this.config;
  }

  public updateConfig(newConfig: any) {
    this.config = { ...this.config, ...newConfig };
  }

  public async start() {
    if (this.status === 'RUNNING' || this.status === 'STARTING') return;
    this.status = 'STARTING';

    try {
      // 1. Get configuration
      let dbConfig = await prisma.botConfig.findUnique({ where: { id: 'global' } });
      if (!dbConfig) {
        dbConfig = await prisma.botConfig.create({
          data: { id: 'global', isActive: true }
        });
      } else if (!dbConfig.isActive) {
        await prisma.botConfig.update({ where: { id: 'global' }, data: { isActive: true } });
      }

      this.config = {
        timeframe: dbConfig.timeframe,
        smaPeriod: dbConfig.smaPeriod,
        volumeMultiplier: dbConfig.volumeMultiplier,
        minVolume: dbConfig.minVolume,
        minGreenCandles: dbConfig.minGreenCandles || 0,
        minPriceChange: dbConfig.minPriceChange || 0.0,
        totalCapital: dbConfig.totalCapital || 1000.0,
        tradeAmount: dbConfig.tradeAmount || 100.0,
        trailingStopPct: dbConfig.trailingStopPct || 1.5,
      };

      // Load active paper trades from DB
      const openTrades = await prisma.paperTrade.findMany({ where: { status: 'OPEN' } });
      this.activePaperTrades = {};
      openTrades.forEach(t => {
        this.activePaperTrades[t.symbol] = t;
      });

      // 2. Fetch Symbols
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const tickers: any[] = await res.json();

      this.activeSymbols = tickers
        .filter(t => t.symbol.endsWith('USDT') && parseFloat(t.volume) > 1000)
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .map(t => t.symbol);

      console.log(`[Bot] Monitored pairs: ${this.activeSymbols.length}`);

      // Update Coins in DB
      for (const sym of this.activeSymbols) {
        await prisma.coin.upsert({
          where: { symbol: sym },
          update: { isActive: true },
          create: { symbol: sym, isActive: true }
        });
      }

      // 3. Pre-fetch historical volumes
      console.log('[Bot] Waking up background data...');
      for (const symbol of this.activeSymbols) {
        try {
          const klineRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${this.config.timeframe}&limit=${this.config.smaPeriod}`);
          const klines = await klineRes.json();
          this.volumeHistory[symbol] = klines.map((k: any) => parseFloat(k[5]));
        } catch (err) {
          console.error(`[Bot] Failed fetching historical data for ${symbol}`);
        }
        await new Promise(r => setTimeout(r, 30));
      }

      // 4. Connect to WebSockets
      const streams = this.activeSymbols.map(s => `${s.toLowerCase()}@kline_${this.config.timeframe}`).join('/');
      const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Bot] WebSocket Connected');
        this.status = 'RUNNING';
      };

      this.ws.onmessage = async (event) => {
        const data = JSON.parse(event.data.toString());
        if (data.e === 'kline') {
          const symbol = data.s;
          const kline = data.k;
          const isFinal = kline.x;
          const currentVolume = parseFloat(kline.v);
          const currentPrice = parseFloat(kline.c);

          // Real-time trailing stop check
          if (this.activePaperTrades[symbol]) {
            const trade = this.activePaperTrades[symbol];
            
            // Update peak price
            if (currentPrice > trade.peakPrice) {
              trade.peakPrice = currentPrice;
              await prisma.paperTrade.update({
                where: { id: trade.id },
                data: { peakPrice: currentPrice }
              });
            }

            // Check trailing stop
            const stopPrice = trade.peakPrice * (1 - this.config.trailingStopPct / 100);
            if (currentPrice <= stopPrice) {
              await this.executePaperSell(symbol, currentPrice);
            }
          }

          if (!this.volumeHistory[symbol] || this.volumeHistory[symbol].length === 0) return;

          const history = this.volumeHistory[symbol];
          const averageVolume = history.reduce((a, b) => a + b, 0) / history.length;

          const openPrice = parseFloat(kline.o);
          const priceChangePercent = Math.abs(((currentPrice - openPrice) / openPrice) * 100);

          if (
            averageVolume >= this.config.minVolume &&
            currentVolume > averageVolume * this.config.volumeMultiplier &&
            priceChangePercent >= this.config.minPriceChange
          ) {
            if (this.config.minGreenCandles === 0) {
              await this.triggerAlert({
                symbol,
                currentVolume,
                previousVolume: averageVolume,
                multiplier: currentVolume / averageVolume,
                price: currentPrice,
              });
            } else if (!this.pendingAlerts[symbol]) {
              console.log(`[Bot] Potential breakout ${symbol}. Waiting for confirmation...`);
              this.pendingAlerts[symbol] = {
                count: 0,
                price: currentPrice,
                prevVol: averageVolume,
                currVol: currentVolume,
                mult: currentVolume / averageVolume
              };
            }
          }

          if (isFinal) {
            if (this.pendingAlerts[symbol]) {
              const open = parseFloat(kline.o);
              const close = parseFloat(kline.c);
              const isGreen = close > open;

              if (isGreen) {
                this.pendingAlerts[symbol].count++;
                if (this.pendingAlerts[symbol].count >= this.config.minGreenCandles) {
                  const alert = this.pendingAlerts[symbol];
                  await this.triggerAlert({
                    symbol,
                    currentVolume: alert.currVol,
                    previousVolume: alert.prevVol,
                    multiplier: alert.mult,
                    price: alert.price,
                  });
                  delete this.pendingAlerts[symbol];
                }
              } else {
                delete this.pendingAlerts[symbol];
              }
            }

            this.volumeHistory[symbol].push(currentVolume);
            if (this.volumeHistory[symbol].length > this.config.smaPeriod) {
              this.volumeHistory[symbol].shift();
            }
          }
        }
      };

      this.ws.onerror = (err) => {
        console.error('[Bot] WebSocket Error', err);
        this.status = 'ERROR';
      };

      this.ws.onclose = () => {
        console.log('[Bot] WebSocket Closed');
        if (this.status === 'RUNNING') this.status = 'STOPPED';
      };

    } catch (error) {
      console.error('[Bot] Start failed:', error);
      this.status = 'ERROR';
    }
  }

  private async triggerAlert(data: { symbol: string, currentVolume: number, previousVolume: number, multiplier: number, price: number }) {
    console.log(`[ALERT] 🚀 Breakout ${data.symbol}! Vol: ${data.currentVolume.toFixed(2)} Price: ${data.price}`);

    const cutoff = new Date(Date.now() - 3 * 60 * 1000);
    const recent = await prisma.breakoutAlert.findFirst({
      where: { symbol: data.symbol, timestamp: { gt: cutoff } }
    });

    if (!recent) {
      await prisma.breakoutAlert.create({
        data: {
          symbol: data.symbol,
          timeframe: this.config.timeframe,
          previousVolume: data.previousVolume,
          currentVolume: data.currentVolume,
          multiplier: data.multiplier,
          priceAtBreakout: data.price
        }
      });

      // Automatically execute paper buy if not already in a trade for this symbol
      if (!this.activePaperTrades[data.symbol]) {
        await this.executePaperBuy(data.symbol, data.price);
      }
    }
  }

  private async executePaperBuy(symbol: string, price: number) {
    const openTrades = Object.values(this.activePaperTrades);
    const investedCapital = openTrades.reduce((sum, t: any) => sum + t.invested, 0);
    const availableCapital = this.config.totalCapital - investedCapital;

    if (availableCapital < this.config.tradeAmount) {
      console.log(`[Paper] Skipping ${symbol} - Insufficient capital (Available: ${availableCapital.toFixed(2)})`);
      return;
    }

    const amount = this.config.tradeAmount / price;
    
    try {
      const trade = await prisma.paperTrade.create({
        data: {
          symbol,
          buyPrice: price,
          amount: amount,
          invested: this.config.tradeAmount,
          peakPrice: price,
          status: 'OPEN'
        }
      });

      this.activePaperTrades[symbol] = trade;
      console.log(`[Paper] 🟢 BOUGHT ${symbol} at ${price}. Amount: ${amount.toFixed(4)}`);
    } catch (err) {
      console.error(`[Paper] Failed to record buy for ${symbol}:`, err);
    }
  }

  private async executePaperSell(symbol: string, price: number) {
    const trade = this.activePaperTrades[symbol];
    if (!trade) return;

    const pnl = (price - trade.buyPrice) * trade.amount;
    const pnlPercent = ((price - trade.buyPrice) / trade.buyPrice) * 100;

    try {
      await prisma.paperTrade.update({
        where: { id: trade.id },
        data: {
          closePrice: price,
          status: 'CLOSED',
          pnl: pnl,
          pnlPercent: pnlPercent,
          closedAt: new Date()
        }
      });

      delete this.activePaperTrades[symbol];
      console.log(`[Paper] 🔴 SOLD ${symbol} at ${price}. PnL: ${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
    } catch (err) {
      console.error(`[Paper] Failed to record sell for ${symbol}:`, err);
    }
  }

  public async stop() {
    this.status = 'STOPPED';
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    await prisma.botConfig.updateMany({
      where: { id: 'global' },
      data: { isActive: false }
    });
    console.log('[Bot] Successfully stopped');
  }
}

// Singleton Pattern for Next.js hot reload
const globalForBot = global as unknown as { botService: BinanceBotService };
export const botService = globalForBot.botService || new BinanceBotService();
if (process.env.NODE_ENV !== 'production') globalForBot.botService = botService;
