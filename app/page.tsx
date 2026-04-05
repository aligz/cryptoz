'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Terminal as TerminalIcon, Activity, Settings2, Play, Square, RefreshCcw, ShieldCheck, Database, Zap } from 'lucide-react';

export default function Dashboard() {
  const [status, setStatus] = useState<string>('STOPPED');
  const [monitoredCount, setMonitoredCount] = useState<number>(0);
  const [config, setConfig] = useState<any>({ 
    timeframe: '5m', smaPeriod: 20, volumeMultiplier: 3, minVolume: 10000, 
    minGreenCandles: 0, minPriceChange: 0, totalCapital: 1000, 
    tradeAmount: 100, trailingStopPct: 1.5 
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'trades'>('alerts');
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fetchData = async () => {
    try {
      const [botRes, alertsRes, tradesRes] = await Promise.all([
        fetch('/api/bot'),
        fetch('/api/breakouts?limit=25'),
        fetch('/api/trades?limit=50')
      ]);
      const botData = await botRes.json();
      const alertsData = await alertsRes.json();
      const tradesData = await tradesRes.json();

      if (botData.status) setStatus(botData.status);
      if (botData.monitoredCount !== undefined) setMonitoredCount(botData.monitoredCount);
      
      if (botData.config && !savingConfig && !isEditing) {
        setConfig(botData.config);
      }
      
      if (Array.isArray(alertsData)) {
        setAlerts(alertsData);
      }
      
      if (Array.isArray(tradesData)) {
        setTrades(tradesData);
      }
    } catch (e) {
      console.error('Failed to sync data');
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [isEditing, savingConfig]);

  const handleStartStop = async (action: 'start' | 'stop') => {
    setStatus(action === 'start' ? 'STARTING' : 'STOPPED');
    await fetch('/api/bot', {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    fetchData();
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        body: JSON.stringify(config)
      });
      const updatedConfig = await res.json();
      if (updatedConfig && !updatedConfig.error) {
        setConfig(updatedConfig);
      }
    } catch (e) {
      console.error('Failed to save config');
    } finally {
      setIsEditing(false);
      setSavingConfig(false);
      fetchData();
    }
  };

  const updateConfigField = (field: string, value: any) => {
    setIsEditing(true);
    setConfig({ ...config, [field]: value });
  };

  const calculateTotalPnL = () => {
    return trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] terminal-theme p-4 text-[#E2E8F0] selection:bg-[#00FFD1] selection:text-[#0A0A0F] font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b-2 border-[#00FFD1]/30 pb-4">
          <div className="flex items-center gap-3 text-[#00FFD1]">
            <Activity className="animate-pulse" size={28} />
            <div>
              <h1 className="text-2xl font-bold tracking-tighter uppercase tabular-nums">Breakout Engine v2.0</h1>
              <p className="text-[10px] text-[#00FFD1]/50 uppercase tracking-widest">// LOCAL_PAPER_TRADING_ACTIVE</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <div className={`px-4 py-1.5 uppercase text-xs font-bold tracking-wider border flex items-center gap-2 ${status === 'RUNNING' ? 'bg-[#00FFD1]/10 text-[#00FFD1] border-[#00FFD1]' : status === 'STARTING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500' : 'bg-red-500/10 text-red-500 border-red-500'}`}>
              <div className={`w-2 h-2 rounded-full ${status === 'RUNNING' ? 'bg-[#00FFD1] animate-pulse' : status === 'STARTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
              {status}
            </div>
            <div className="px-4 py-1.5 uppercase text-xs font-bold tracking-wider border bg-[#00FFD1]/5 text-[#00FFD1] border-[#00FFD1]/30">
              PNL: <span className={calculateTotalPnL() >= 0 ? 'text-green-400' : 'text-red-400'}>
                ${calculateTotalPnL().toFixed(2)}
              </span>
            </div>
            {status === 'RUNNING' && (
              <div className="px-4 py-1.5 uppercase text-xs font-bold tracking-wider border bg-[#00FFD1]/5 text-[#00FFD1] border-[#00FFD1]/30">
                LOCKED: {monitoredCount} PAIRS
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CONTROL PANEL */}
          <div className="space-y-6">
            <Card className="border-2 border-[#00FFD1]/50 bg-[#0A0A0F] rounded-none shadow-[0_0_10px_rgba(0,255,209,0.1)]">
              <CardHeader className="border-b border-[#00FFD1]/20 pb-4">
                <CardTitle className="text-[#00FFD1] text-sm uppercase tracking-widest flex items-center gap-2">
                  <TerminalIcon size={16} /> ENGINE_CONTROL
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-4">
                  <Button 
                    onClick={() => handleStartStop('start')}
                    disabled={status === 'RUNNING' || status === 'STARTING'}
                    className="flex-1 rounded-none border border-[#00FFD1] bg-[#00FFD1]/10 font-bold hover:bg-[#00FFD1] hover:text-[#0A0A0F] text-[#00FFD1] uppercase tracking-widest"
                  >
                    <Play size={16} className="mr-2" /> Start
                  </Button>
                  <Button 
                    onClick={() => handleStartStop('stop')}
                    disabled={status === 'STOPPED'}
                    className="flex-1 rounded-none border border-red-500 bg-red-500/10 font-bold hover:bg-red-500 hover:text-white text-red-500 uppercase tracking-widest"
                  >
                    <Square size={16} className="mr-2" /> Stop
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* SETTINGS PANEL */}
            <Card className="border border-[#00FFD1]/30 bg-[#0A0A0F] rounded-none">
              <CardHeader className="border-b border-[#00FFD1]/20 pb-4">
                <CardTitle className="text-[#00FFD1]/80 text-sm uppercase tracking-widest flex items-center gap-2">
                  <Settings2 size={16} /> PARAMETERS
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">Timeframe</Label>
                    <select 
                      value={config.timeframe} 
                      onChange={e => updateConfigField('timeframe', e.target.value)}
                      className="w-full bg-transparent border border-[#00FFD1]/40 text-[#00FFD1] p-2 text-xs focus:outline-none focus:border-[#00FFD1] appearance-none"
                    >
                      <option value="1m">1m</option>
                      <option value="5m">5m</option>
                      <option value="15m">15m</option>
                      <option value="1h">1h</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">SMA Period</Label>
                    <Input 
                      type="number" 
                      value={config.smaPeriod} 
                      onChange={e => updateConfigField('smaPeriod', parseInt(e.target.value) || 20)}
                      className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">Vol Mult (X)</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={config.volumeMultiplier} 
                      onChange={e => updateConfigField('volumeMultiplier', parseFloat(e.target.value) || 3)}
                      className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">Min Vol (USDT)</Label>
                    <Input 
                      type="number" 
                      value={config.minVolume} 
                      onChange={e => updateConfigField('minVolume', parseFloat(e.target.value) || 0)}
                      className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">Min Price Chg (%)</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={config.minPriceChange} 
                      onChange={e => updateConfigField('minPriceChange', parseFloat(e.target.value) || 0)}
                      className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">Green Candles</Label>
                    <Input 
                      type="number" 
                      value={config.minGreenCandles} 
                      onChange={e => updateConfigField('minGreenCandles', parseInt(e.target.value) || 0)}
                      className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="border-t border-[#00FFD1]/10 pt-4 mt-2">
                  <p className="text-[10px] text-yellow-500 uppercase tracking-widest mb-3">// PAPER_TRADING_CONFIG</p>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">Total Capital (USDT)</Label>
                    <Input 
                      type="number" 
                      value={config.totalCapital} 
                      onChange={e => updateConfigField('totalCapital', parseFloat(e.target.value) || 1000)}
                      className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">Size per Trade</Label>
                      <Input 
                        type="number" 
                        value={config.tradeAmount} 
                        onChange={e => updateConfigField('tradeAmount', parseFloat(e.target.value) || 100)}
                        className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] text-[#00FFD1]/70 uppercase tracking-wider">Trailing %</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={config.trailingStopPct} 
                        onChange={e => updateConfigField('trailingStopPct', parseFloat(e.target.value) || 1.5)}
                        className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="w-full bg-[#00FFD1]/20 border border-[#00FFD1]/60 text-[#00FFD1] hover:bg-[#00FFD1] hover:text-[#0A0A0F] rounded-none text-[10px] uppercase tracking-widest mt-4"
                >
                  {savingConfig ? 'Applying...' : 'Update Engine Parameters'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* MAIN DATA VIEW */}
          <div className="lg:col-span-2">
            <Card className="border border-[#00FFD1]/30 bg-[#0A0A0F] rounded-none h-full min-h-[600px] flex flex-col">
              <CardHeader className="border-b border-[#00FFD1]/20 pb-0 px-0">
                <div className="flex px-4 items-center justify-between mb-4">
                  <CardTitle className="text-[#00FFD1] text-sm uppercase tracking-widest flex items-center gap-2">
                    <Database size={16} /> DATA_STREAM
                  </CardTitle>
                </div>
                
                {/* TABS */}
                <div className="flex border-t border-[#00FFD1]/10">
                  <button 
                    onClick={() => setActiveTab('alerts')}
                    className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'alerts' ? 'bg-[#00FFD1]/10 text-[#00FFD1] border-b-2 border-[#00FFD1]' : 'text-[#E2E8F0]/30 hover:text-[#E2E8F0]/60'}`}
                  >
                    Breakout Alerts ({alerts.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('trades')}
                    className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'trades' ? 'bg-[#00FFD1]/10 text-[#00FFD1] border-b-2 border-[#00FFD1]' : 'text-[#E2E8F0]/30 hover:text-[#E2E8F0]/60'}`}
                  >
                    Paper Trades ({trades.length})
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-0 px-0 flex-1 overflow-auto">
                {activeTab === 'alerts' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-[#00FFD1]/60 uppercase border-b border-[#00FFD1]/20 bg-[#00FFD1]/5">
                        <tr>
                          <th className="px-6 py-3 font-medium tracking-wider">Time</th>
                          <th className="px-6 py-3 font-medium tracking-wider">Pair</th>
                          <th className="px-6 py-3 font-medium tracking-wider text-right">Spike</th>
                          <th className="px-6 py-3 font-medium tracking-wider text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#00FFD1]/5">
                        {alerts.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-20 text-[#00FFD1]/20 text-xs">// SCANNING_MARKET...</td></tr>
                        ) : (
                          alerts.map((alert) => (
                            <tr key={alert.id} className="hover:bg-[#00FFD1]/5 transition-colors group">
                              <td className="px-6 py-4 text-[#E2E8F0]/50 text-[10px] tabular-nums">
                                {new Date(alert.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                                <Zap size={12} className="text-yellow-400 opacity-50" />
                                <a 
                                  href={`https://www.tradingview.com/chart/?symbol=BINANCE:${alert.symbol}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:text-[#00FFD1] hover:underline transition-colors"
                                >
                                  {alert.symbol}
                                </a>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="bg-[#00FFD1]/10 text-[#00FFD1] px-2 py-0.5 border border-[#00FFD1]/20 text-[10px]">
                                  {alert.multiplier.toFixed(1)}x
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-xs tabular-nums text-[#E2E8F0]/80">
                                ${alert.priceAtBreakout?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-[#00FFD1]/60 uppercase border-b border-[#00FFD1]/20 bg-[#00FFD1]/5">
                        <tr>
                          <th className="px-6 py-3 font-medium tracking-wider">Pair</th>
                          <th className="px-6 py-3 font-medium tracking-wider">Status</th>
                          <th className="px-6 py-3 font-medium tracking-wider text-right">Entry</th>
                          <th className="px-6 py-3 font-medium tracking-wider text-right">PnL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#00FFD1]/5">
                        {trades.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-20 text-[#00FFD1]/20 text-xs">// NO_TRADES_RECORDED</td></tr>
                        ) : (
                          trades.map((trade) => (
                            <tr key={trade.id} className="hover:bg-[#00FFD1]/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-white">{trade.symbol}</div>
                                <div className="text-[9px] text-[#E2E8F0]/40">{new Date(trade.createdAt).toLocaleString()}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] uppercase px-2 py-0.5 border ${trade.status === 'OPEN' ? 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10' : 'border-[#E2E8F0]/20 text-[#E2E8F0]/40 bg-[#E2E8F0]/5'}`}>
                                  {trade.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right tabular-nums text-xs">
                                ${trade.buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                              </td>
                              <td className={`px-6 py-4 text-right tabular-nums font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.pnl ? `${trade.pnl.toFixed(2)}$` : '---'}
                                <div className="text-[10px] font-normal opacity-70">
                                  {trade.pnlPercent ? `${trade.pnlPercent.toFixed(2)}%` : ''}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
