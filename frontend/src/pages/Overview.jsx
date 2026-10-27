import React from 'react';
import { useTrading } from '../context/TradingContext';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  PieChart,
  Bot,
  Play,
  Pause,
} from 'lucide-react';

export default function Overview() {
  const { settings, riskState, positions, health, botStatus, toggleBot, setActiveTab, resetKillSwitch, resetPaperSession } = useTrading();

  const allocatedCapital = Number(settings?.allocated_capital || 50000);
  const realisedPnL = Number(riskState?.realisedPnL || 0);
  const unrealisedPnL = Number(riskState?.unrealisedPnL || 0);
  const totalPnL = Number(riskState?.totalPnL || 0);
  const lossLimitAmount = Number(riskState?.dailyLossLimitAmount || 750);
  const openPositionsCount = Array.isArray(positions) ? positions.length : 0;
  const maxPositions = Number(settings?.maximum_open_positions || 3);
  const deployedCapital = Number(riskState?.deployedCapital || 0);
  const capitalUtilisation = Number(riskState?.capitalUtilisationPercent || 0);

  // Daily loss percentage used
  const dailyLossUsedPercent = lossLimitAmount > 0
    ? Math.min(100, Math.max(0, (Math.abs(Math.min(0, totalPnL)) / lossLimitAmount) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Welcome / Mode Status */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-gray-900 via-gray-900 to-indigo-950/40 border border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Trading Control Center
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {settings?.trading_mode || 'PAPER'} MODE
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Realtime monitoring for Indian equity momentum and swing execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('scanner')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Launch Scanner
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTab('backtest')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700"
          >
            Run Backtest
          </button>
        </div>
      </div>

      {/* Circuit Breaker Emergency Banner (when halted) */}
      {riskState?.tradingHalted && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Circuit Breaker Active — Automated Trading Halted</span>
              </div>
              <div className="text-xs text-rose-300/80 font-mono mt-0.5">
                {riskState?.haltReason || 'Daily loss limit or emergency risk threshold triggered.'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {settings?.trading_mode === 'PAPER' && (
              <button
                onClick={resetPaperSession}
                className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer"
              >
                Reset Paper Session
              </button>
            )}
            <button
              onClick={resetKillSwitch}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors cursor-pointer"
            >
              Clear Halt
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Allocated Capital */}
        <div className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Allocated Capital</span>
            <Wallet className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            ₹{allocatedCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-gray-500">
            Deployed: ₹{deployedCapital.toLocaleString('en-IN')} ({capitalUtilisation}%)
          </div>
        </div>

        {/* Realised P&L */}
        <div className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Today's Realised P&L</span>
            <div className="flex items-center gap-1.5">
              {settings?.trading_mode === 'PAPER' && realisedPnL !== 0 && (
                <button
                  onClick={resetPaperSession}
                  className="text-[10px] text-gray-400 hover:text-emerald-400 underline font-mono cursor-pointer"
                >
                  Reset
                </button>
              )}
              {realisedPnL >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono ${realisedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {realisedPnL >= 0 ? '+' : ''}₹{realisedPnL.toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">
            Unrealised: <span className={unrealisedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{unrealisedPnL >= 0 ? '+' : ''}₹{unrealisedPnL.toFixed(2)}</span>
          </div>
        </div>

        {/* Daily Risk / Loss Limit Gauge */}
        <div className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Daily Loss Limit Usage</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {dailyLossUsedPercent.toFixed(1)}%
            </div>
            <span className="text-xs font-mono text-gray-400">Max ₹{lossLimitAmount.toFixed(0)}</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                dailyLossUsedPercent > 80 ? 'bg-rose-500' : dailyLossUsedPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${dailyLossUsedPercent}%` }}
            />
          </div>
        </div>

        {/* Open Positions Slot Usage */}
        <div className="p-4 rounded-xl bg-[#111827] border border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Active Position Slots</span>
            <PieChart className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {openPositionsCount} / {maxPositions}
          </div>
          <div className="text-[11px] text-gray-500">
            {maxPositions - openPositionsCount > 0 ? `${maxPositions - openPositionsCount} slot(s) available` : 'Capacity full'}
          </div>
        </div>
      </div>

      {/* Autonomous Bot Master Status Card */}
      <div className={`p-5 rounded-xl border transition-all ${
        botStatus?.isRunning
          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
          : 'bg-[#111827] border-gray-800'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              botStatus?.isRunning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse' : 'bg-gray-800 text-gray-500'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Autonomous Algorithmic Trading Bot</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  botStatus?.isRunning ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-gray-800 text-gray-400'
                }`}>
                  {botStatus?.isRunning ? 'RUNNING (AUTO-EXECUTION ON)' : 'PAUSED'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">
                {botStatus?.lastLogMessage || 'Continuous scanning and auto execution standby.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block font-mono text-xs">
              <span className="text-gray-400">Auto Trades Today: </span>
              <span className="font-bold text-white">{botStatus?.totalAutoTrades || 0}</span>
            </div>

            <button
              onClick={toggleBot}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-md ${
                botStatus?.isRunning
                  ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              {botStatus?.isRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause Auto-Bot
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Auto-Trading Bot
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Information Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy Status Card */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              Active Algorithmic Strategy Rules
            </h3>
            <span className="text-xs font-mono text-gray-400">
              {settings?.selected_strategy || 'INTRADAY_MOMENTUM'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800 space-y-2">
              <div className="font-semibold text-gray-200">Intraday Entry Hypotheses</div>
              <ul className="space-y-1.5 text-gray-400 list-disc list-inside">
                <li>Price &gt; EMA 20 &amp; EMA 20 &gt; EMA 50 (Bullish trend stack)</li>
                <li>RSI 14 between 55 and 70 (Strong upward momentum)</li>
                <li>Relative Volume (RVOL) &ge; 1.0 (Liquidity confirmation)</li>
                <li>ATR 14 dynamic volatility stop-loss &amp; profit target</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800 space-y-2">
              <div className="font-semibold text-gray-200">Risk Pre-Execution Safeguards</div>
              <ul className="space-y-1.5 text-gray-400 list-disc list-inside">
                <li>Strict 0.5% max risk per trade calculation</li>
                <li>Circuit breaker freezes new entries at 1.5% daily loss</li>
                <li>No duplicate position entries into the same stock</li>
                <li>Automated stop-loss order reconciliation</li>
              </ul>
            </div>
          </div>
        </div>

        {/* System Health & Connection Card */}
        <div className="p-5 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">System Diagnostics</h3>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Execution Mode</span>
              <span className="font-semibold text-amber-400 font-mono">{settings?.trading_mode || 'PAPER'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Database Storage</span>
              <span className="font-semibold text-emerald-400 font-mono">
                {health?.supabaseConnected ? 'Supabase PostgreSQL' : 'Local In-Memory Repository'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">FYERS API v3 Status</span>
              <span className="font-semibold text-emerald-400 font-mono">{health?.brokerSessionStatus || 'READY'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Live Trading Flag</span>
              <span className={`font-semibold font-mono ${settings?.live_trading_enabled ? 'text-rose-400' : 'text-gray-500'}`}>
                {settings?.live_trading_enabled ? 'ENABLED' : 'DISABLED (SAFE)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Emergency Circuit Breaker</span>
              <span className={`font-semibold font-mono ${riskState?.tradingHalted ? 'text-rose-500' : 'text-emerald-400'}`}>
                {riskState?.tradingHalted ? 'HALTED' : 'NORMAL'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
