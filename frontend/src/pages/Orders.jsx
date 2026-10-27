import React, { useState, useEffect } from 'react';
import { useTrading } from '../context/TradingContext';
import { Layers, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

export default function Orders() {
  const { settings } = useTrading();
  const [subTab, setSubTab] = useState('orders'); // 'orders' | 'trades'
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordRes, trdRes] = await Promise.all([
        fetch('/api/v1/orders').then((r) => r.json()),
        fetch('/api/v1/trades').then((r) => r.json()),
      ]);
      setOrders(ordRes || []);
      setTrades(trdRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'FILLED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">FILLED</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">REJECTED</span>;
      case 'UNKNOWN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">UNKNOWN</span>;
      case 'SUBMITTED':
      case 'ACKNOWLEDGED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">PENDING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Subtabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111827] border border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => setSubTab('orders')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                subTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Order Book ({orders.length})
            </button>
            <button
              onClick={() => setSubTab('trades')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                subTab === 'trades' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Trade Book ({trades.length})
            </button>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors border border-gray-700 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Orders Table */}
      {subTab === 'orders' ? (
        <div className="rounded-xl bg-[#111827] border border-gray-800 overflow-hidden shadow-xl">
          {orders.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-xs">No orders recorded yet.</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-semibold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Time</th>
                      <th className="py-3.5 px-4">Order ID</th>
                      <th className="py-3.5 px-4">Symbol</th>
                      <th className="py-3.5 px-4 text-center">Side</th>
                      <th className="py-3.5 px-4 text-right">Qty / Fill</th>
                      <th className="py-3.5 px-4 text-right">Avg Price</th>
                      <th className="py-3.5 px-4 text-center">Mode</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 font-mono">
                    {orders.map((o) => (
                      <tr key={o.id || o.internal_order_id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                          {new Date(o.submitted_at).toLocaleTimeString()}
                        </td>
                        <td className="py-3.5 px-4 text-gray-300 font-normal text-[11px]">
                          {o.internal_order_id?.slice(0, 18)}...
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {o.symbol}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {o.side}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-200">
                          {o.filled_quantity} / {o.quantity}
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-200">
                          ₹{Number(o.average_fill_price || o.price || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-[10px] text-gray-400">{o.trading_mode}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(o.order_status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card-Based Order View */}
              <div className="block md:hidden divide-y divide-gray-800 font-mono">
                {orders.map((o) => (
                  <div key={o.id || o.internal_order_id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          o.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {o.side}
                        </span>
                        <span className="text-sm font-bold text-white">{o.symbol}</span>
                      </div>
                      {getStatusBadge(o.order_status)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-900/40 p-2.5 rounded-lg border border-gray-800/80">
                      <div>
                        <span className="text-gray-400">Qty / Fill: </span>
                        <span className="font-bold text-white">{o.filled_quantity} / {o.quantity}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Price: </span>
                        <span className="font-bold text-gray-200">₹{Number(o.average_fill_price || o.price || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Time: </span>
                        <span className="text-gray-300">{new Date(o.submitted_at).toLocaleTimeString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Mode: </span>
                        <span className="text-gray-300">{o.trading_mode}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Trade Book Table */
        <div className="rounded-xl bg-[#111827] border border-gray-800 overflow-hidden shadow-xl">
          {trades.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-xs">No closed round-trip trades recorded yet.</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-semibold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Exit Time</th>
                      <th className="py-3.5 px-4">Symbol / Strategy</th>
                      <th className="py-3.5 px-4 text-right">Qty</th>
                      <th className="py-3.5 px-4 text-right">Entry (₹)</th>
                      <th className="py-3.5 px-4 text-right">Exit (₹)</th>
                      <th className="py-3.5 px-4 text-right">Charges (₹)</th>
                      <th className="py-3.5 px-4 text-right">Net Realised P&L</th>
                      <th className="py-3.5 px-4 text-center">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 font-mono">
                    {trades.map((t) => {
                      const pnl = Number(t.realised_pnl);
                      return (
                        <tr key={t.id} className="hover:bg-gray-800/40 transition-colors">
                          <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                            {new Date(t.exit_timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div>{t.symbol}</div>
                            <div className="text-[10px] text-gray-500">{t.strategy}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right text-gray-200">
                            {t.quantity}
                          </td>
                          <td className="py-3.5 px-4 text-right text-gray-300">
                            ₹{Number(t.entry_price).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-gray-100">
                            ₹{Number(t.exit_price).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-amber-400/90">
                            ₹{Number(t.estimated_charges || 0).toFixed(2)}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="text-[10px] text-gray-400">{t.trading_mode}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card-Based Trade View */}
              <div className="block md:hidden divide-y divide-gray-800 font-mono">
                {trades.map((t) => {
                  const pnl = Number(t.realised_pnl);
                  return (
                    <div key={t.id} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white">{t.symbol}</div>
                          <div className="text-[10px] text-gray-400">{t.strategy} • {new Date(t.exit_timestamp).toLocaleTimeString()}</div>
                        </div>
                        <div className={`text-sm font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-900/40 p-2.5 rounded-lg border border-gray-800/80">
                        <div>
                          <span className="text-gray-400">Quantity: </span>
                          <span className="font-bold text-white">{t.quantity}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Entry: </span>
                          <span className="text-gray-200">₹{Number(t.entry_price).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Exit: </span>
                          <span className="text-gray-200">₹{Number(t.exit_price).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Charges: </span>
                          <span className="text-amber-400">₹{Number(t.estimated_charges || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
