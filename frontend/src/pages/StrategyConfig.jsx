import React, { useState, useEffect } from 'react';
import { useTrading } from '../context/TradingContext';
import { useToast } from '../context/ToastContext';
import { Sliders, Plus, Trash2, CheckCircle2, Shield, Save } from 'lucide-react';

export default function StrategyConfig() {
  const { settings, fetchSystemData } = useTrading();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    allocated_capital: 50000,
    risk_per_trade: 0.5,
    daily_loss_limit: 1.5,
    maximum_open_positions: 3,
    maximum_capital_utilisation: 50.0,
    selected_strategy: 'INTRADAY_MOMENTUM',
  });

  const [watchlist, setWatchlist] = useState([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newStrategy, setNewStrategy] = useState('INTRADAY_MOMENTUM');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        allocated_capital: settings.allocated_capital,
        risk_per_trade: settings.risk_per_trade,
        daily_loss_limit: settings.daily_loss_limit,
        maximum_open_positions: settings.maximum_open_positions,
        maximum_capital_utilisation: settings.maximum_capital_utilisation,
        selected_strategy: settings.selected_strategy,
      });
    }
    loadWatchlist();
  }, [settings]);

  const loadWatchlist = async () => {
    try {
      const res = await fetch('/api/v1/watchlist');
      const data = await res.json();
      setWatchlist(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Risk limits and strategy parameters saved successfully!', 'success');
        fetchSystemData();
      } else {
        addToast(data.error || 'Failed to update settings', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSymbol = async (e) => {
    e.preventDefault();
    let sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    if (!sym.startsWith('NSE:')) sym = `NSE:${sym}`;
    if (!sym.endsWith('-EQ')) sym = `${sym}-EQ`;

    try {
      const res = await fetch('/api/v1/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, exchange: 'NSE', strategy: newStrategy }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`Added ${sym} to watchlist`, 'success');
        setNewSymbol('');
        loadWatchlist();
      } else {
        addToast(data.error || 'Failed to add symbol', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleToggleSymbol = async (symbol, enabled) => {
    try {
      await fetch(`/api/v1/watchlist/${encodeURIComponent(symbol)}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      loadWatchlist();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleRemoveSymbol = async (symbol) => {
    try {
      await fetch(`/api/v1/watchlist/${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
      });
      addToast(`Removed ${symbol} from watchlist`, 'info');
      loadWatchlist();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Risk and Capital Management Form */}
      <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Dynamic Capital &amp; Risk Controls
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Strict mathematical boundaries enforced on every order submission before broker routing.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Allocated Capital */}
            <div>
              <label className="block text-gray-300 font-semibold mb-1">
                Allocated Trading Capital (₹)
              </label>
              <input
                type="number"
                min="5000"
                step="1000"
                value={form.allocated_capital}
                onChange={(e) => setForm({ ...form, allocated_capital: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Upper bound capital TradePilot is authorized to deploy.
              </span>
            </div>

            {/* Risk Per Trade */}
            <div>
              <label className="block text-gray-300 font-semibold mb-1">
                Risk Per Trade (% of Capital)
              </label>
              <input
                type="number"
                min="0.1"
                max="5.0"
                step="0.1"
                value={form.risk_per_trade}
                onChange={(e) => setForm({ ...form, risk_per_trade: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Default: 0.5% (₹{((form.allocated_capital * form.risk_per_trade) / 100).toFixed(0)} max risk per trade).
              </span>
            </div>

            {/* Daily Loss Limit */}
            <div>
              <label className="block text-gray-300 font-semibold mb-1">
                Daily Circuit Breaker Loss Limit (%)
              </label>
              <input
                type="number"
                min="0.5"
                max="10.0"
                step="0.25"
                value={form.daily_loss_limit}
                onChange={(e) => setForm({ ...form, daily_loss_limit: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Freezes new entries when today's loss hits ₹{((form.allocated_capital * form.daily_loss_limit) / 100).toFixed(0)}.
              </span>
            </div>

            {/* Max Open Positions */}
            <div>
              <label className="block text-gray-300 font-semibold mb-1">
                Max Concurrent Open Positions
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={form.maximum_open_positions}
                onChange={(e) => setForm({ ...form, maximum_open_positions: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Prevents portfolio over-concentration (default 3).
              </span>
            </div>

            {/* Max Capital Utilisation */}
            <div>
              <label className="block text-gray-300 font-semibold mb-1">
                Max Capital Utilisation (%)
              </label>
              <input
                type="number"
                min="10"
                max="100"
                step="5"
                value={form.maximum_capital_utilisation}
                onChange={(e) => setForm({ ...form, maximum_capital_utilisation: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Caps total margin across all active positions (default 50%).
              </span>
            </div>

            {/* Primary Strategy Selection */}
            <div>
              <label className="block text-gray-300 font-semibold mb-1">
                Default Strategy Engine
              </label>
              <select
                value={form.selected_strategy}
                onChange={(e) => setForm({ ...form, selected_strategy: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                <option value="INTRADAY_MOMENTUM">Strategy A: Intraday Momentum (5/15m)</option>
                <option value="SWING_TREND">Strategy B: Swing Trend Following (Daily)</option>
              </select>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Strategy algorithm executed during automated scans.
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg shadow-indigo-900/30"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Limits...' : 'Save Risk Parameters'}
            </button>
          </div>
        </form>
      </div>

      {/* Watchlist Manager */}
      <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Authorized Watchlist Manager ({watchlist.length})
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage tradable NSE equity instruments scanned for entry signals.
            </p>
          </div>
        </div>

        {/* Add Symbol Form */}
        <form onSubmit={handleAddSymbol} className="flex flex-col sm:flex-row gap-3 text-xs">
          <input
            type="text"
            placeholder="e.g. NSE:WIPRO-EQ or WIPRO"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
          />
          <select
            value={newStrategy}
            onChange={(e) => setNewStrategy(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
          >
            <option value="INTRADAY_MOMENTUM">INTRADAY_MOMENTUM</option>
            <option value="SWING_TREND">SWING_TREND</option>
          </select>
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Symbol
          </button>
        </form>

        {/* Watchlist Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {watchlist.map((item) => (
            <div
              key={item.symbol}
              className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                item.enabled
                  ? 'bg-gray-900/80 border-gray-700 text-gray-200'
                  : 'bg-gray-950/40 border-gray-800 text-gray-500'
              }`}
            >
              <div>
                <div className="font-mono font-semibold text-xs">{item.symbol}</div>
                <div className="text-[10px] text-gray-400">{item.strategy}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleSymbol(item.symbol, item.enabled)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    item.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {item.enabled ? 'ACTIVE' : 'PAUSED'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveSymbol(item.symbol)}
                  className="text-gray-500 hover:text-rose-400 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
