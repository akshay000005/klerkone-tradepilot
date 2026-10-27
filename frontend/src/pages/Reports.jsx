import React, { useState, useEffect } from 'react';
import { useTrading } from '../context/TradingContext';
import { BarChart3, TrendingUp, TrendingDown, PieChart, Receipt, Calendar } from 'lucide-react';

export default function Reports() {
  const { settings, riskState } = useTrading();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/trades')
      .then((r) => r.json())
      .then((data) => setTrades(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => Number(t.realised_pnl) > 0);
  const losingTrades = trades.filter((t) => Number(t.realised_pnl) < 0);
  const totalNetPnL = trades.reduce((sum, t) => sum + Number(t.realised_pnl), 0);
  const totalCharges = trades.reduce((sum, t) => sum + Number(t.estimated_charges || 0), 0);

  // Approximate charges breakdown based on Indian statutory proportions
  const estimatedBrokerage = Number((totalCharges * 0.45).toFixed(2));
  const estimatedSTT = Number((totalCharges * 0.25).toFixed(2));
  const estimatedGST = Number((totalCharges * 0.18).toFixed(2));
  const estimatedStampNSE = Number((totalCharges * 0.12).toFixed(2));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-xl bg-[#111827] border border-gray-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          Financial P&amp;L &amp; Statutory Cost Reporting
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Detailed performance attribution, win/loss distribution, and breakdown of Indian equity execution taxes.
        </p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
          <span className="text-xs text-gray-400">Total Closed Deals</span>
          <div className="text-2xl font-bold font-mono text-white">{totalTrades}</div>
          <span className="text-[11px] text-gray-500">
            {winningTrades.length} Wins • {losingTrades.length} Losses
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
          <span className="text-xs text-gray-400">Net Realised P&L</span>
          <div className={`text-2xl font-bold font-mono ${totalNetPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalNetPnL >= 0 ? '+' : ''}₹{totalNetPnL.toFixed(2)}
          </div>
          <span className="text-[11px] text-gray-500">After all fees &amp; taxes</span>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
          <span className="text-xs text-gray-400">Total Statutory Costs</span>
          <div className="text-2xl font-bold font-mono text-amber-400">
            ₹{totalCharges.toFixed(2)}
          </div>
          <span className="text-[11px] text-gray-500">Brokerage, STT, GST, NSE</span>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
          <span className="text-xs text-gray-400">Win Rate</span>
          <div className="text-2xl font-bold font-mono text-white">
            {totalTrades > 0 ? ((winningTrades.length / totalTrades) * 100).toFixed(1) : 0}%
          </div>
          <span className="text-[11px] text-gray-500">Success frequency</span>
        </div>
      </div>

      {/* Detailed Charges Breakdown Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            Statutory Transaction Costs Breakdown
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between p-2.5 rounded bg-gray-900 border border-gray-800">
              <span className="text-gray-300">FYERS Brokerage (₹20 cap / Intraday, ₹0 / Delivery)</span>
              <span className="text-white font-semibold">₹{estimatedBrokerage.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-gray-900 border border-gray-800">
              <span className="text-gray-300">STT (Securities Transaction Tax)</span>
              <span className="text-white font-semibold">₹{estimatedSTT.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-gray-900 border border-gray-800">
              <span className="text-gray-300">GST (18% on Brokerage &amp; Charges)</span>
              <span className="text-white font-semibold">₹{estimatedGST.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-gray-900 border border-gray-800">
              <span className="text-gray-300">Exchange Turnover &amp; Stamp Duty (NSE / State)</span>
              <span className="text-white font-semibold">₹{estimatedStampNSE.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Win/Loss Attribution */}
        <div className="p-5 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-400" />
            Trade Distribution
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-1">
              <span className="text-emerald-400 text-[11px] font-semibold">Winning Deals</span>
              <div className="text-2xl font-bold text-emerald-300">{winningTrades.length}</div>
              <span className="text-[10px] text-gray-500">Profitable exits</span>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-center space-y-1">
              <span className="text-rose-400 text-[11px] font-semibold">Losing Deals</span>
              <div className="text-2xl font-bold text-rose-300">{losingTrades.length}</div>
              <span className="text-[10px] text-gray-500">Stop-loss triggers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
