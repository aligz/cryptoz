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
  const [config, setConfig] = useState<any>({ timeframe: '5m', smaPeriod: 20, volumeMultiplier: 3, minVolume: 10000 });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fetchData = async () => {
    try {
      const [botRes, alertsRes] = await Promise.all([
        fetch('/api/bot'),
        fetch('/api/breakouts?limit=25')
      ]);
      const botData = await botRes.json();
      const alertsData = await alertsRes.json();

      if (botData.status) setStatus(botData.status);
      if (botData.monitoredCount !== undefined) setMonitoredCount(botData.monitoredCount);
      
      // Only sync config if we are not currently editing it to prevent UI overwrite
      if (botData.config && !savingConfig && !isEditing) {
        setConfig(botData.config);
      }
      setAlerts(alertsData);
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
  }, [isEditing]); // Re-subscribe when editing state changes to ensure fresh data if stopped editing

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
    await fetch('/api/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
    setIsEditing(false); // Done editing
    setSavingConfig(false);
    fetchData();
  };

  const updateConfigField = (field: string, value: any) => {
    setIsEditing(true);
    setConfig({ ...config, [field]: value });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] terminal-theme p-4 text-[#E2E8F0] selection:bg-[#00FFD1] selection:text-[#0A0A0F] font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b-2 border-[#00FFD1]/30 pb-4">
          <div className="flex items-center gap-3 text-[#00FFD1]">
            <Activity className="animate-pulse" size={28} />
            <div>
              <h1 className="text-2xl font-bold tracking-tighter uppercase tabular-nums">Volume Breakout Scanner</h1>
              <p className="text-[10px] text-[#00FFD1]/50 uppercase tracking-widest">// SYSTEM_ONLINE</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <div className={`px-4 py-1.5 uppercase text-xs font-bold tracking-wider border flex items-center gap-2 ${status === 'RUNNING' ? 'bg-[#00FFD1]/10 text-[#00FFD1] border-[#00FFD1]' : status === 'STARTING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500' : 'bg-red-500/10 text-red-500 border-red-500'}`}>
              <div className={`w-2 h-2 rounded-full ${status === 'RUNNING' ? 'bg-[#00FFD1] animate-pulse' : status === 'STARTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
              {status}
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
                <p className="text-xs text-[#E2E8F0]/70">
                  // Initialize or terminate the background scanning process.
                </p>
                <div className="flex gap-4">
                  <Button 
                    onClick={() => handleStartStop('start')}
                    disabled={status === 'RUNNING' || status === 'STARTING'}
                    className="flex-1 rounded-none border border-[#00FFD1] bg-[#00FFD1]/10 font-bold hover:bg-[#00FFD1] hover:text-[#0A0A0F] text-[#00FFD1] uppercase tracking-widest"
                  >
                    <Play size={16} className="mr-2" /> Start Bot
                  </Button>
                  <Button 
                    onClick={() => handleStartStop('stop')}
                    disabled={status === 'STOPPED'}
                    className="flex-1 rounded-none border border-red-500 bg-red-500/10 font-bold hover:bg-red-500 hover:text-white text-red-500 uppercase tracking-widest"
                  >
                    <Square size={16} className="mr-2" /> Halt
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
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs text-[#00FFD1]/70 uppercase tracking-wider">Timeframe</Label>
                  <select 
                    value={config.timeframe} 
                    onChange={e => updateConfigField('timeframe', e.target.value)}
                    className="w-full bg-transparent border border-[#00FFD1]/40 text-[#00FFD1] p-2 text-sm focus:outline-none focus:border-[#00FFD1] appearance-none"
                  >
                    <option value="1m">1 Minute</option>
                    <option value="3m">3 Minutes</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[#00FFD1]/70 uppercase tracking-wider">SMA Period (Candles)</Label>
                  <Input 
                    type="number" 
                    value={config.smaPeriod} 
                    onChange={e => updateConfigField('smaPeriod', parseInt(e.target.value) || 20)}
                    className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none focus-visible:ring-1 focus-visible:ring-[#00FFD1]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[#00FFD1]/70 uppercase tracking-wider">Volume Multiplier (X)</Label>
                  <Input 
                    type="number" 
                    step="0.5"
                    value={config.volumeMultiplier} 
                    onChange={e => updateConfigField('volumeMultiplier', parseFloat(e.target.value) || 3.0)}
                    className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none focus-visible:ring-1 focus-visible:ring-[#00FFD1]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[#00FFD1]/70 uppercase tracking-wider">Minimum Volume (USDT)</Label>
                  <Input 
                    type="number" 
                    step="1000"
                    value={config.minVolume} 
                    onChange={e => updateConfigField('minVolume', parseFloat(e.target.value) || 0)}
                    className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none focus-visible:ring-1 focus-visible:ring-[#00FFD1]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[#00FFD1]/70 uppercase tracking-wider">Green Candles Confirmation</Label>
                  <Input 
                    type="number" 
                    min="0"
                    max="10"
                    value={config.minGreenCandles || 0} 
                    onChange={e => updateConfigField('minGreenCandles', parseInt(e.target.value) || 0)}
                    className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none focus-visible:ring-1 focus-visible:ring-[#00FFD1]"
                  />
                  <p className="text-[10px] text-[#00FFD1]/40 tracking-tight italic">// Wait for N green candles after breakout signal.</p>
                </div>
                <Button 
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="w-full bg-transparent border border-[#00FFD1]/60 text-[#00FFD1] hover:bg-[#00FFD1]/20 rounded-none text-xs uppercase tracking-widest mt-2"
                >
                  {savingConfig ? 'Applying...' : 'Apply Config'}
                </Button>
                {status === 'RUNNING' && (
                  <p className="text-[10px] text-yellow-500/70 mt-2">// Applying config will automatically restart the bot engine.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* DATA TABLE */}
          <div className="lg:col-span-2">
            <Card className="border border-[#00FFD1]/30 bg-[#0A0A0F] rounded-none h-full min-h-[600px]">
              <CardHeader className="border-b border-[#00FFD1]/20 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-[#00FFD1] text-sm uppercase tracking-widest flex items-center gap-2">
                  <Database size={16} /> LIVE_FEED_ALERTS
                </CardTitle>
                <div className="text-[#00FFD1]/50 text-xs flex items-center gap-2 animate-pulse">
                  <RefreshCcw size={12} /> Auto-sync enabled
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-[#00FFD1]/60 uppercase border-b border-[#00FFD1]/20 bg-[#00FFD1]/5">
                      <tr>
                        <th className="px-6 py-3 font-medium tracking-wider">Time</th>
                        <th className="px-6 py-3 font-medium tracking-wider">Pair</th>
                        <th className="px-6 py-3 font-medium tracking-wider">Timeframe</th>
                        <th className="px-6 py-3 font-medium tracking-wider text-right">Spike</th>
                        <th className="px-6 py-3 font-medium tracking-wider text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-[#00FFD1]/30 font-mono text-xs">
                            {loading ? 'INITIALIZING_DATALINK...' : '// NO_BREAKOUT_DETECTED_YET'}
                          </td>
                        </tr>
                      ) : (
                        alerts.map((alert, i) => (
                          <tr key={alert.id} className="border-b border-[#00FFD1]/10 hover:bg-[#00FFD1]/5 transition-colors group">
                            <td className="px-6 py-4 text-[#E2E8F0]/70 text-xs">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                              <Zap size={14} className="text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <a 
                                href={`https://www.tradingview.com/chart/?symbol=BINANCE:${alert.symbol}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-[#00FFD1] hover:underline transition-colors"
                              >
                                {alert.symbol}
                              </a>
                            </td>
                            <td className="px-6 py-4 text-[#00FFD1]/70">{alert.timeframe}</td>
                            <td className="px-6 py-4 text-right">
                              <span className="bg-[#00FFD1]/10 text-[#00FFD1] px-2 py-1 border border-[#00FFD1]/30 font-bold">
                                {alert.multiplier.toFixed(1)}x
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right tabular-nums text-[#E2E8F0]/90">
                              ${alert.priceAtBreakout?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) || 'N/A'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
