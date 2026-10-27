import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import { useToast } from '../context/ToastContext';
import { Briefcase, AlertCircle, LogOut } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

export default function Positions() {
  const { positions, settings, fetchSystemData } = useTrading();
  const { addToast } = useToast();
  const [selectedExitPos, setSelectedExitPos] = useState(null);
  const [exiting, setExiting] = useState(false);

  const handleManualExit = async () => {
    if (!selectedExitPos) return;
    setExiting(true);

    try {
      const res = await fetch('/api/v1/positions/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedExitPos.symbol,
          tradingMode: selectedExitPos.trading_mode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast(`Position closed for ${selectedExitPos.symbol}. P&L reconciled.`, 'success');
        fetchSystemData();
      } else {
        addToast(data.error || 'Failed to square off position', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setExiting(false);
      setSelectedExitPos(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111827] border border-gray-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Active Portfolio Positions
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {positions.length} Open
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Realtime monitoring with automated stop-loss protection and manual square-off controls.
          </p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="rounded-xl bg-[#111827] border border-gray-800 overflow-hidden shadow-xl">
        {positions.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <Briefcase className="w-10 h-10 text-gray-600 mx-auto" />
            <div className="text-sm font-medium">No open positions currently held.</div>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              The automated scanner will enter positions when technical criteria and risk verification pass.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Symbol / Strategy</th>
                    <th className="py-3.5 px-4 text-center">Mode</th>
                    <th className="py-3.5 px-4 text-right">Qty</th>
                    <th className="py-3.5 px-4 text-right">Avg Entry</th>
                    <th className="py-3.5 px-4 text-right">Current Price</th>
                    <th className="py-3.5 px-4 text-right">Stop Loss</th>
                    <th className="py-3.5 px-4 text-right">Target</th>
                    <th className="py-3.5 px-4 text-right">Unrealised P&L</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 font-mono">
                  {positions.map((pos) => {
                    const entry = Number(pos.average_entry_price);
                    const current = Number(pos.current_market_price || entry);
                    const qty = Number(pos.quantity);
                    const unPnl = Number(((current - entry) * qty).toFixed(2));
                    const unPnlPercent = entry > 0 ? Number((((current - entry) / entry) * 100).toFixed(2)) : 0;

                    return (
                      <tr key={`${pos.symbol}-${pos.trading_mode}`} className="hover:bg-gray-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div>{pos.symbol}</div>
                          <div className="text-[10px] text-gray-500 font-normal">{pos.strategy}</div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pos.trading_mode === 'LIVE'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {pos.trading_mode}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-gray-200">
                          {pos.quantity}
                        </td>

                        <td className="py-3.5 px-4 text-right text-gray-300">
                          ₹{entry.toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-gray-100">
                          ₹{current.toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4 text-right text-rose-400">
                          {pos.current_stop_loss ? `₹${Number(pos.current_stop_loss).toFixed(2)}` : '-'}
                        </td>

                        <td className="py-3.5 px-4 text-right text-emerald-400">
                          {pos.current_target ? `₹${Number(pos.current_target).toFixed(2)}` : '-'}
                        </td>

                        <td className={`py-3.5 px-4 text-right font-bold ${unPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {unPnl >= 0 ? '+' : ''}₹{unPnl.toFixed(2)} ({unPnlPercent}%)
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedExitPos(pos)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Exit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-Based Position View */}
            <div className="block md:hidden divide-y divide-gray-800 font-mono">
              {positions.map((pos) => {
                const entry = Number(pos.average_entry_price);
                const current = Number(pos.current_market_price || entry);
                const qty = Number(pos.quantity);
                const unPnl = Number(((current - entry) * qty).toFixed(2));
                const unPnlPercent = entry > 0 ? Number((((current - entry) / entry) * 100).toFixed(2)) : 0;

                return (
                  <div key={`${pos.symbol}-${pos.trading_mode}`} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white">{pos.symbol}</div>
                        <div className="text-[10px] text-gray-400">{pos.strategy}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pos.trading_mode === 'LIVE'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {pos.trading_mode}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
                      <div>
                        <div className="text-[10px] text-gray-400">Unrealised P&L</div>
                        <div className={`text-base font-bold ${unPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {unPnl >= 0 ? '+' : ''}₹{unPnl.toFixed(2)} ({unPnlPercent}%)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400">Current LTP</div>
                        <div className="text-sm font-bold text-gray-100">₹{current.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-900/30 p-2.5 rounded-lg border border-gray-800/80">
                      <div>
                        <span className="text-gray-400">Quantity: </span>
                        <span className="font-bold text-white">{pos.quantity}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Avg Entry: </span>
                        <span className="font-bold text-gray-200">₹{entry.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Stop Loss: </span>
                        <span className="font-bold text-rose-400">
                          {pos.current_stop_loss ? `₹${Number(pos.current_stop_loss).toFixed(2)}` : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Target: </span>
                        <span className="font-bold text-emerald-400">
                          {pos.current_target ? `₹${Number(pos.current_target).toFixed(2)}` : '-'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedExitPos(pos)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 transition-colors shadow-sm"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Square Off Position
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Manual Exit Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(selectedExitPos)}
        title="Confirm Position Exit"
        message={
          <div>
            Are you sure you want to square off your position of{' '}
            <strong className="text-white">{selectedExitPos?.quantity} shares</strong> of{' '}
            <strong className="text-white">{selectedExitPos?.symbol}</strong> ({selectedExitPos?.trading_mode} mode) at the current market price?
          </div>
        }
        confirmText={exiting ? 'Closing...' : 'Square Off Position'}
        confirmVariant="danger"
        onConfirm={handleManualExit}
        onCancel={() => setSelectedExitPos(null)}
      />
    </div>
  );
}
