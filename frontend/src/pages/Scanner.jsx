import React, { useState, useEffect } from 'react';
import { useTrading } from '../context/TradingContext';
import { useToast } from '../context/ToastContext';
import { RefreshCw, CheckCircle2, XCircle, ArrowUpRight, Zap, Info, Sparkles } from 'lucide-react';

export default function Scanner() {
  const { settings, fetchSystemData } = useTrading();
  const { addToast } = useToast();
  const [scannerData, setScannerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [executingSymbol, setExecutingSymbol] = useState(null);
  const [aiCopilot, setAiCopilot] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const handleOpenSignalModal = async (item) => {
    setSelectedSignal(item);
    setAiCopilot(null);
    setLoadingAi(true);
    try {
      const res = await fetch('/api/v1/ai/explain-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: item.symbol,
          ltp: item.ltp,
          signal: item.signal,
          snapshot: item.signal?.indicator_snapshot,
        }),
      });
      const data = await res.json();
      setAiCopilot(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchScanner = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch('/api/v1/scanner');
      const data = await res.json();
      if (res.ok) {
        setScannerData(data.results || []);
      } else if (isInitial) {
        addToast(data.error || 'Failed to scan market', 'error');
      }
    } catch (err) {
      if (isInitial) addToast(err.message, 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchScanner(true);
    const interval = setInterval(() => fetchScanner(false), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleExecuteSignal = async (item) => {
    const signal = item.signal;
    if (!signal || !signal.is_valid) {
      addToast('Cannot execute trade: Technical entry conditions are not satisfied.', 'warning');
      return;
    }

    setExecutingSymbol(item.symbol);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: item.symbol,
          side: 'BUY',
          quantity: signal.suggested_quantity || 10,
          price: item.ltp,
          stopLoss: signal.stop_loss,
          targetPrice: signal.target_price,
          strategy: item.strategy,
          orderType: 'MARKET',
          tradingMode: settings?.trading_mode || 'PAPER',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast(`Order executed successfully for ${item.symbol}! Status: ${data.status}`, 'success');
        fetchSystemData();
      } else {
        addToast(data.reason || data.error || 'Order rejected by risk engine', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setExecutingSymbol(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111827] border border-gray-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Automated Market Scanner
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
              {scannerData.length} NSE Shares
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Realtime technical indicator scan and explainable condition validation.
          </p>
        </div>

        <button
          onClick={fetchScanner}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors border border-gray-700 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Scanner
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl bg-[#111827] border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Symbol</th>
                <th className="py-3.5 px-4 text-right">LTP (₹)</th>
                <th className="py-3.5 px-4 text-right">Change</th>
                <th className="py-3.5 px-4 text-center">EMA 20 / 50</th>
                <th className="py-3.5 px-4 text-center">VWAP</th>
                <th className="py-3.5 px-4 text-center">Supertrend</th>
                <th className="py-3.5 px-4 text-center">RSI (14)</th>
                <th className="py-3.5 px-4 text-center">RVOL</th>
                <th className="py-3.5 px-4 text-center">Score</th>
                <th className="py-3.5 px-4 text-center">Signal</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 font-mono">
              {scannerData.map((item) => {
                const signal = item.signal || {};
                const snap = signal.indicator_snapshot || {};
                const isBuy = signal.is_valid && signal.signal_type === 'BUY';
                const score = signal.signal_score || 0;

                return (
                  <tr key={item.symbol} className="hover:bg-gray-800/40 transition-colors">
                    {/* Symbol */}
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div>{item.symbol}</div>
                      <div className="text-[10px] text-gray-500 font-normal">{item.strategy}</div>
                    </td>

                    {/* LTP */}
                    <td className="py-3.5 px-4 text-right font-bold text-gray-200">
                      ₹{item.ltp?.toFixed(2)}
                    </td>

                    {/* Change */}
                    <td className={`py-3.5 px-4 text-right ${item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.change >= 0 ? '+' : ''}{item.change?.toFixed(2)} ({item.changePercent?.toFixed(2)}%)
                    </td>

                    {/* EMA */}
                    <td className="py-3.5 px-4 text-center text-gray-300">
                      {snap.emaFast ? snap.emaFast.toFixed(1) : '-'} / {snap.emaSlow ? snap.emaSlow.toFixed(1) : '-'}
                    </td>

                    {/* VWAP */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={snap.vwap && item.ltp >= snap.vwap ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>
                        {snap.vwap ? `₹${snap.vwap.toFixed(1)}` : '-'}
                      </span>
                    </td>

                    {/* Supertrend */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        snap.supertrendTrend === 'BULLISH'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : snap.supertrendTrend === 'BEARISH'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {snap.supertrendTrend || 'NEUTRAL'}
                      </span>
                    </td>

                    {/* RSI */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        snap.rsi >= 55 && snap.rsi <= 70
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : snap.rsi > 70
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {snap.rsi ? snap.rsi.toFixed(1) : '-'}
                      </span>
                    </td>

                    {/* RVOL */}
                    <td className="py-3.5 px-4 text-center text-gray-300">
                      {snap.rvol ? `${snap.rvol.toFixed(2)}x` : '-'}
                    </td>

                    {/* Score */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleOpenSignalModal(item)}
                        className={`px-2.5 py-1 rounded font-bold text-[11px] transition-colors border ${
                          score >= 80
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                            : score >= 50
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                        }`}
                      >
                        {score}%
                      </button>
                    </td>

                    {/* Signal */}
                    <td className="py-3.5 px-4 text-center">
                      {isBuy ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                          BUY SIGNAL
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-500 font-medium">
                          NO TRADE
                        </span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        disabled={!isBuy || executingSymbol === item.symbol}
                        onClick={() => handleExecuteSignal(item)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                          isBuy
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-indigo-900/30'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-800'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        {executingSymbol === item.symbol ? 'Sending...' : 'Trade'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card-Based List View (visible on screens < 768px) */}
      <div className="block md:hidden space-y-3 font-mono">
        {scannerData.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-[#111827] rounded-xl border border-gray-800 text-xs">
            Scanning watchlist symbols...
          </div>
        ) : (
          scannerData.map((item) => {
            const signal = item.signal || {};
            const snap = signal.indicator_snapshot || {};
            const isBuy = signal.is_valid && signal.signal_type === 'BUY';
            const score = signal.signal_score || 0;

            return (
              <div
                key={item.symbol}
                className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-3 shadow-md"
              >
                {/* Header: Symbol & Score */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white tracking-wide">{item.symbol}</div>
                    <span className="text-[10px] text-gray-400 font-normal">{item.strategy}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenSignalModal(item)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                        score >= 80
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : score >= 50
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      }`}
                    >
                      {score}% Score
                    </button>
                    {isBuy ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                        BUY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-400">
                        WAIT
                      </span>
                    )}
                  </div>
                </div>

                {/* Price & Change Banner */}
                <div className="flex items-baseline justify-between pt-1 border-t border-gray-800/60">
                  <div>
                    <div className="text-lg font-bold text-white">₹{item.ltp?.toFixed(2)}</div>
                    <div className={`text-xs ${item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.change >= 0 ? '+' : ''}{item.change?.toFixed(2)} ({item.changePercent?.toFixed(2)}%)
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-gray-400">
                    <div>RVOL: <span className="font-semibold text-gray-200">{snap.rvol ? `${snap.rvol.toFixed(2)}x` : '-'}</span></div>
                    <div>RSI: <span className="font-semibold text-gray-200">{snap.rsi ? snap.rsi.toFixed(1) : '-'}</span></div>
                  </div>
                </div>

                {/* Technical Indicators Pill Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-900/60 p-2.5 rounded-lg border border-gray-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Supertrend:</span>
                    <span className={`font-bold text-[10px] px-1.5 py-0.2 rounded ${
                      snap.supertrendTrend === 'BULLISH'
                        ? 'text-emerald-300 bg-emerald-500/20'
                        : snap.supertrendTrend === 'BEARISH'
                        ? 'text-rose-300 bg-rose-500/20'
                        : 'text-gray-400'
                    }`}>
                      {snap.supertrendTrend || 'NEUTRAL'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">VWAP:</span>
                    <span className={snap.vwap && item.ltp >= snap.vwap ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>
                      {snap.vwap ? `₹${snap.vwap.toFixed(1)}` : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">EMA 20/50:</span>
                    <span className="text-gray-300">
                      {snap.emaFast ? snap.emaFast.toFixed(0) : '-'} / {snap.emaSlow ? snap.emaSlow.toFixed(0) : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Setup:</span>
                    <span className={isBuy ? 'text-emerald-400 font-semibold' : 'text-gray-500'}>
                      {isBuy ? 'Confirmed' : 'Monitoring'}
                    </span>
                  </div>
                </div>

                {/* Score Progress Bar */}
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-gray-700'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>

                {/* Action Buttons: Explain and 1-Tap Trade */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleOpenSignalModal(item)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    Explain Signal
                  </button>

                  <button
                    disabled={!isBuy || executingSymbol === item.symbol}
                    onClick={() => handleExecuteSignal(item)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                      isBuy
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-indigo-900/30'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-800'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {executingSymbol === item.symbol ? 'Executing...' : isBuy ? 'Execute Buy' : 'No Signal'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Explainable Conditions Modal */}
      {selectedSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111827] border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Explainable Signal Breakdown: {selectedSignal.symbol}</span>
                </h3>
                <span className="text-xs text-gray-400">Score: {selectedSignal.signal?.signal_score}%</span>
              </div>
              <button
                onClick={() => setSelectedSignal(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* AI Trade Copilot Analysis Box */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-gray-900 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>AI Trade Copilot Analysis</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                    {aiCopilot?.provider === 'google_gemini_free' ? 'Google Gemini AI (Free)' : 'Quant Copilot AI (Free)'}
                  </span>
                </div>

                {loadingAi ? (
                  <div className="text-gray-400 text-xs py-2 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    Synthesizing quantitative indicators...
                  </div>
                ) : aiCopilot ? (
                  <div className="space-y-2 text-xs">
                    <p className="leading-relaxed text-gray-300">{aiCopilot.narrative}</p>
                    <div className="p-2 rounded bg-indigo-900/20 border border-indigo-500/20 text-indigo-200 text-[11px]">
                      <strong className="text-white">Key Insight: </strong>{aiCopilot.keyInsight}
                    </div>
                    {aiCopilot.chargesAdvice && (
                      <div className="text-[10px] text-amber-300/80 font-mono">
                        💡 {aiCopilot.chargesAdvice}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-xs">Analysis ready.</div>
                )}
              </div>

              {/* Conditions Satisfied */}
              <div>
                <div className="font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Conditions Satisfied ({selectedSignal.signal?.conditions_met?.length || 0})
                </div>
                <div className="space-y-1.5">
                  {selectedSignal.signal?.conditions_met?.map((c, i) => (
                    <div key={i} className="p-2.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-emerald-200">
                      <div className="font-semibold">{c.name} (+{c.weight} pts)</div>
                      <div className="text-[11px] text-emerald-400/80 mt-0.5">{c.description}</div>
                    </div>
                  ))}
                  {(!selectedSignal.signal?.conditions_met || selectedSignal.signal.conditions_met.length === 0) && (
                    <div className="text-gray-500">None satisfied.</div>
                  )}
                </div>
              </div>

              {/* Conditions Failed */}
              <div>
                <div className="font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Conditions Not Satisfied ({selectedSignal.signal?.conditions_failed?.length || 0})
                </div>
                <div className="space-y-1.5">
                  {selectedSignal.signal?.conditions_failed?.map((c, i) => (
                    <div key={i} className="p-2.5 rounded bg-rose-950/30 border border-rose-500/20 text-rose-200">
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-[11px] text-rose-400/80 mt-0.5">{c.reason}</div>
                    </div>
                  ))}
                  {(!selectedSignal.signal?.conditions_failed || selectedSignal.signal.conditions_failed.length === 0) && (
                    <div className="text-emerald-400">All algorithmic conditions met!</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setSelectedSignal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
