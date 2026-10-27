import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import { ShieldAlert, ShieldCheck, Activity, Power, AlertOctagon, RotateCcw, Bot } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

export default function Header() {
  const { settings, health, riskState, botStatus, toggleBot, switchTradingMode, triggerKillSwitch, resetKillSwitch } = useTrading();
  const [killModalOpen, setKillModalOpen] = useState(false);
  const [squareOffChecked, setSquareOffChecked] = useState(true);

  const currentMode = settings?.trading_mode || 'PAPER';
  const isHalted = riskState?.tradingHalted;
  const isFyersConnected = health?.brokerSessionStatus === 'CONNECTED';
  const isBotRunning = botStatus?.isRunning;

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0b0f19]/90 backdrop-blur-md border-b border-gray-800 px-6 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">KlerkOne TradePilot</h1>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">NSE EQ</span>
              </div>
              <p className="text-xs text-gray-400 font-mono">Automated Quant Platform • FYERS API v3</p>
            </div>
          </div>

          {/* Status Badges & Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Indicator & Selector */}
            <div className="flex items-center bg-[#111827] border border-gray-800 rounded-lg p-1">
              <button
                onClick={() => switchTradingMode('BACKTEST')}
                className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                  currentMode === 'BACKTEST' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                BACKTEST
              </button>
              <button
                onClick={() => switchTradingMode('PAPER')}
                className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                  currentMode === 'PAPER' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                PAPER<span className="hidden sm:inline"> TRADING</span>
              </button>
              <button
                onClick={() => switchTradingMode('LIVE')}
                className={`px-2 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                  currentMode === 'LIVE' ? 'bg-rose-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'
                }`}
              >
                LIVE<span className="hidden sm:inline"> TRADING</span>
              </button>
            </div>

            {/* Auto Trading Bot Switch */}
            <button
              onClick={toggleBot}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
                isBotRunning
                  ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300 shadow-emerald-900/30'
                  : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              <Bot className={`w-3.5 h-3.5 ${isBotRunning ? 'text-emerald-400 animate-bounce' : 'text-gray-500'}`} />
              <span>AUTO-BOT: {isBotRunning ? 'ACTIVE' : 'OFF'}</span>
            </button>

            {/* Broker Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] border border-gray-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${isFyersConnected ? 'bg-emerald-500 animate-ping' : 'bg-gray-500'}`} />
              <span className="text-gray-300 font-medium">FYERS:</span>
              <span className={isFyersConnected ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>
                {isFyersConnected ? 'CONNECTED' : 'MOCK / READY'}
              </span>
            </div>

            {/* Circuit Breaker / Kill Switch Button */}
            {isHalted ? (
              <button
                onClick={resetKillSwitch}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Circuit Breaker
              </button>
            ) : (
              <button
                onClick={() => setKillModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 text-xs font-semibold transition-colors shadow-sm"
              >
                <Power className="w-3.5 h-3.5 text-rose-400" />
                KILL SWITCH
              </button>
            )}
          </div>
        </div>

        {/* Global Alert Bar if trading is halted */}
        {isHalted && (
          <div className="mt-3 py-2 px-4 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>TRADING SYSTEM HALTED:</strong> {riskState?.haltReason || 'Circuit breaker active. New order placement is blocked.'}
              </span>
            </div>
            <button
              onClick={resetKillSwitch}
              className="underline hover:text-white font-medium ml-4 shrink-0"
            >
              Resume Monitoring
            </button>
          </div>
        )}
      </header>

      {/* Emergency Kill Switch Modal */}
      <ConfirmationModal
        isOpen={killModalOpen}
        title="EMERGENCY TRADING HALT"
        message={
          <div className="space-y-3">
            <p className="text-rose-300 font-medium">
              Activating the Emergency Kill Switch will immediately block all new order submissions across the entire system.
            </p>
            <label className="flex items-center gap-2 cursor-pointer bg-black/40 p-3 rounded-lg border border-gray-800">
              <input
                type="checkbox"
                checked={squareOffChecked}
                onChange={(e) => setSquareOffChecked(e.target.checked)}
                className="rounded border-gray-700 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs text-gray-200 font-medium">
                Immediately square off all currently open positions at market price
              </span>
            </label>
          </div>
        }
        confirmText="HALT SYSTEM NOW"
        confirmVariant="danger"
        onConfirm={() => {
          triggerKillSwitch(squareOffChecked);
          setKillModalOpen(false);
        }}
        onCancel={() => setKillModalOpen(false)}
      />
    </>
  );
}
