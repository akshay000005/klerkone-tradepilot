import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { Play, LineChart, TrendingUp, TrendingDown, Layers, ShieldCheck, Activity, Award } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Backtesting() {
  const { addToast } = useToast();
  const [symbol, setSymbol] = useState('NSE:RELIANCE-EQ');
  const [strategy, setStrategy] = useState('INTRADAY_MOMENTUM');
  const [initialCapital, setInitialCapital] = useState(50000);
  const [riskPercent, setRiskPercent] = useState(0.5);
  const [slippage, setSlippage] = useState(0.05);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [sensitivityResult, setSensitivityResult] = useState(null);
  const [runningSensitivity, setRunningSensitivity] = useState(false);

  const handleRunBacktest = async (e) => {
    e.preventDefault();
    setRunning(true);
    setSensitivityResult(null);

    try {
      const res = await fetch('/api/v1/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          strategy,
          initialCapital: Number(initialCapital),
          riskPerTradePercent: Number(riskPercent),
          slippagePercent: Number(slippage),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        addToast(`Backtest complete! Simulated ${data.trades?.length || 0} trades.`, 'success');
      } else {
        addToast(data.error || 'Backtest failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleRunSensitivity = async () => {
    setRunningSensitivity(true);
    try {
      const res = await fetch('/api/v1/backtest/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          strategy,
          initialCapital: Number(initialCapital),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSensitivityResult(data);
        addToast('Parameter sensitivity analysis completed!', 'success');
      } else {
        addToast(data.error || 'Sensitivity analysis failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setRunningSensitivity(false);
    }
  };

  const metrics = result?.metrics;

  return (
    <div className="space-y-6">
      {/* Parameter Control Form */}
      <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Quantitative Strategy Backtesting Engine
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Strict chronological simulation with zero look-ahead bias, realistic slippage, and Indian statutory charges.
            </p>
          </div>
        </div>

        <form onSubmit={handleRunBacktest} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          <div>
            <label className="block text-gray-300 font-semibold mb-1">Target Symbol</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none"
            >
              <option value="NSE:RELIANCE-EQ">NSE:RELIANCE-EQ</option>
              <option value="NSE:TCS-EQ">NSE:TCS-EQ</option>
              <option value="NSE:HDFCBANK-EQ">NSE:HDFCBANK-EQ</option>
              <option value="NSE:INFY-EQ">NSE:INFY-EQ</option>
              <option value="NSE:SBIN-EQ">NSE:SBIN-EQ</option>
              <option value="NSE:ICICIBANK-EQ">NSE:ICICIBANK-EQ</option>
              <option value="NSE:LT-EQ">NSE:LT-EQ</option>
              <option value="NSE:TATAMOTORS-EQ">NSE:TATAMOTORS-EQ</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none"
            >
              <option value="INTRADAY_MOMENTUM">Intraday Momentum (EMA/RSI)</option>
              <option value="SWING_TREND">Swing Trend Following</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Initial Capital (₹)</label>
            <input
              type="number"
              min="10000"
              step="5000"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Risk Per Trade (%)</label>
            <input
              type="number"
              min="0.1"
              max="5.0"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={running}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg shadow-indigo-900/30"
            >
              <Play className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Simulating...' : 'Run Backtest'}
            </button>
          </div>
        </form>
      </div>

      {/* Results View */}
      {metrics && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-400">Net Profit / Loss</span>
              <div className={`text-lg font-bold font-mono ${metrics.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {metrics.netPnL >= 0 ? '+' : ''}₹{metrics.netPnL.toFixed(2)}
              </div>
              <span className="text-[10px] text-gray-500">ROI: {metrics.returnPercent}%</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-400">Win Rate</span>
              <div className="text-lg font-bold font-mono text-white">
                {metrics.winRate}%
              </div>
              <span className="text-[10px] text-gray-500">
                {metrics.winningTrades}W / {metrics.losingTrades}L
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-400">Max Drawdown</span>
              <div className="text-lg font-bold font-mono text-rose-400">
                {metrics.maxDrawdownPercent}%
              </div>
              <span className="text-[10px] text-gray-500">₹{metrics.maxDrawdownAmount}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-400">Profit Factor</span>
              <div className="text-lg font-bold font-mono text-white">
                {metrics.profitFactor}
              </div>
              <span className="text-[10px] text-gray-500">Gross W/L Ratio</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-400">Expectancy / Trade</span>
              <div className={`text-lg font-bold font-mono ${metrics.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{metrics.expectancy}
              </div>
              <span className="text-[10px] text-gray-500">Mathematical Edge</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-400">Trading Charges</span>
              <div className="text-lg font-bold font-mono text-amber-400">
                ₹{metrics.totalCharges}
              </div>
              <span className="text-[10px] text-gray-500">STT, GST, NSE, Broker</span>
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <LineChart className="w-4 h-4 text-indigo-400" />
                Simulated Portfolio Equity Curve
              </h3>
              <span className="text-xs text-gray-400 font-mono">
                Ending Capital: ₹{metrics.endingCapital.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.equityCurve}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis
                    domain={['dataMin - 1000', 'dataMax + 1000']}
                    stroke="#4b5563"
                    fontSize={11}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', fontSize: '12px' }}
                    formatter={(val) => [`₹${Number(val).toFixed(2)}`, 'Equity']}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#equityGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sensitivity Analysis Trigger & Grid */}
          <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-400" />
                  Parameter Sensitivity &amp; Curve-Fitting Verification
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Perturbs EMA and RSI parameters (+/- 25%) to prove strategy resilience versus over-fitting.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunSensitivity}
                disabled={runningSensitivity}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 border border-gray-700 transition-colors"
              >
                {runningSensitivity ? 'Running Grid...' : 'Run Sensitivity Test'}
              </button>
            </div>

            {sensitivityResult && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">Robustness Rating:</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    sensitivityResult.isRobust
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {sensitivityResult.sensitivityScore}
                  </span>
                  <span className="text-gray-400">Average PnL: ₹{sensitivityResult.averagePnL}</span>
                  <span className="text-gray-400">StdDev: ₹{sensitivityResult.stdDevPnL}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  {sensitivityResult.grid.map((cell, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-gray-900 border border-gray-800 flex justify-between items-center">
                      <div>
                        <div className="text-gray-400">EMA {cell.parameters.emaFastPeriod} / RSI {cell.parameters.rsiMin}</div>
                        <div className="text-gray-500 text-[10px]">{cell.totalTrades} Trades • Win: {cell.winRate}%</div>
                      </div>
                      <div className={`font-bold ${cell.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {cell.netPnL >= 0 ? '+' : ''}₹{cell.netPnL.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trade Log Table */}
          <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Simulated Trade-by-Trade Execution Log ({result.trades?.length || 0})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-semibold uppercase">
                    <th className="py-2.5 px-3">Entry Time</th>
                    <th className="py-2.5 px-3">Exit Time</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Entry (₹)</th>
                    <th className="py-2.5 px-3 text-right">Exit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Charges (₹)</th>
                    <th className="py-2.5 px-3 text-right">Net P&L (₹)</th>
                    <th className="py-2.5 px-3 text-center">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 font-mono text-[11px]">
                  {result.trades?.map((t, idx) => (
                    <tr key={idx} className="hover:bg-gray-800/40">
                      <td className="py-2 px-3 text-gray-400">{new Date(t.entry_timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 px-3 text-gray-400">{new Date(t.exit_timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 px-3 text-right text-gray-200">{t.quantity}</td>
                      <td className="py-2 px-3 text-right text-gray-300">₹{t.entry_price.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-gray-200">₹{t.exit_price.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-amber-400">₹{t.estimated_charges.toFixed(2)}</td>
                      <td className={`py-2 px-3 text-right font-bold ${t.realised_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.realised_pnl >= 0 ? '+' : ''}₹{t.realised_pnl.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center text-gray-400">{t.exit_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
