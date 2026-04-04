import prisma from '../prisma';

// Bypass TLS certificate check for local development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

type BotStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR';

class BinanceBotService {
  private status: BotStatus = 'STOPPED';
  private ws: WebSocket | null = null;
  private config = { timeframe: '5m', smaPeriod: 20, volumeMultiplier: 3.0, minVolume: 10000.0, minGreenCandles: 0 };
  private volumeHistory: Record<string, number[]> = {};
  private activeSymbols: string[] = [];
  private pendingAlerts: Record<string, { count: number, price: number, prevVol: number, currVol: number, mult: number }> = {};

  public getStatus(): BotStatus {
    return this.status;
  }

  public getMonitoredCount(): number {
    return this.activeSymbols.length;
  }

  public getConfig() {
    return this.config;
  }

  public updateConfig(newConfig: { timeframe: string, smaPeriod: number, volumeMultiplier: number, minVolume: number, minGreenCandles: number }) {
    this.config = newConfig;
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
      };

      // 2. Fetch Symbols (Top 100 USDT pairs by volume to avoid ws limits, or all)
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const tickers: any[] = await res.json();

      this.activeSymbols = tickers
        .filter(t => t.symbol.endsWith('USDT') && parseFloat(t.volume) > 1000)
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        // limited previously with .slice(0, 50) for demo stability. Now removed to monitor all pairs (Binance ws limit is 1024 streams per connection)
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

      // 3. Pre-fetch historical volumes for SMA calculation
      console.log('[Bot] Waking up background data...');
      for (const symbol of this.activeSymbols) {
        try {
          const klineRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${this.config.timeframe}&limit=${this.config.smaPeriod}`);
          const klines = await klineRes.json();
          this.volumeHistory[symbol] = klines.map((k: any) => parseFloat(k[5])); // index 5 is volume
        } catch (err) {
          console.error(`[Bot] Failed fetching historical data for ${symbol}`);
        }
        // Small delay to prevent rate limit
        await new Promise(r => setTimeout(r, 50));
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

          if (!this.volumeHistory[symbol] || this.volumeHistory[symbol].length === 0) return;

          const history = this.volumeHistory[symbol];
          const averageVolume = history.reduce((a, b) => a + b, 0) / history.length;

          // Check if breakout (even before candle is closed!) - Filter with minVolume limit
          if (averageVolume >= this.config.minVolume && currentVolume > averageVolume * this.config.volumeMultiplier) {
            // Detect Breakout
            if (this.config.minGreenCandles === 0) {
              this.triggerAlert({
                symbol,
                currentVolume,
                previousVolume: averageVolume,
                multiplier: currentVolume / averageVolume,
                price: parseFloat(kline.c),
              });
            } else if (!this.pendingAlerts[symbol]) {
              console.log(`[Bot] Potential breakout ${symbol}. Waiting for ${this.config.minGreenCandles} green candles...`);
              this.pendingAlerts[symbol] = {
                count: 0,
                price: parseFloat(kline.c),
                prevVol: averageVolume,
                currVol: currentVolume,
                mult: currentVolume / averageVolume
              };
            }

            // To prevent spamming alert for the same candle, we can artificially increase the average 
            // or mark this candle as alerted. For simplicity, we just log it and the UI will list it.
            // Let's reset the history a bit or replace the last element so it doesn't alert 100 times min
            this.volumeHistory[symbol].push(currentVolume);
            this.volumeHistory[symbol].shift();
          }

          if (isFinal) {
            // Check for pending alert confirmation
            if (this.pendingAlerts[symbol]) {
              const open = parseFloat(kline.o);
              const close = parseFloat(kline.c);
              const isGreen = close > open;

              if (isGreen) {
                this.pendingAlerts[symbol].count++;
                console.log(`[Bot] ${symbol} confirmed green candle ${this.pendingAlerts[symbol].count}/${this.config.minGreenCandles}`);
                
                if (this.pendingAlerts[symbol].count >= this.config.minGreenCandles) {
                  const alert = this.pendingAlerts[symbol];
                  this.triggerAlert({
                    symbol,
                    currentVolume: alert.currVol,
                    previousVolume: alert.prevVol,
                    multiplier: alert.mult,
                    price: alert.price,
                  });
                  delete this.pendingAlerts[symbol];
                }
              } else {
                console.log(`[Bot] ${symbol} failed confirmation (Red Candle). Cancelled alert.`);
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
        if (this.status === 'RUNNING') {
          this.status = 'STOPPED';
        }
      };

    } catch (error) {
      console.error('[Bot] Start failed:', error);
      this.status = 'ERROR';
    }
  }

  private async triggerAlert(data: { symbol: string, currentVolume: number, previousVolume: number, multiplier: number, price: number }) {
    console.log(`[ALERT] 🚀 Breakout ${data.symbol}! Vol: ${data.currentVolume.toFixed(2)} (Avg: ${data.previousVolume.toFixed(2)})`);

    // Check if we recently alerted this within 3 minutes to avoid spam
    const cutoff = new Date(Date.now() - 3 * 60 * 1000);
    const recent = await prisma.breakoutAlert.findFirst({
      where: {
        symbol: data.symbol,
        timestamp: { gt: cutoff }
      }
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
