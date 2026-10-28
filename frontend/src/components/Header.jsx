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
      <header className="sticky top-0 z-40 bg-[#0b0f19]/95 backdrop-blur-md border-b border-gray-800 px-3 py-2 md:px-6 md:py-3.5">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm md:text-lg font-bold tracking-tight text-white whitespace-nowrap">
                  <span className="hidden sm:inline">KlerkOne </span>TradePilot
                </h1>
                <span className="text-[9px] uppercase font-semibold px-1 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700">NSE</span>
              </div>
              <p className="hidden md:block text-xs text-gray-400 font-mono">Automated Quant Platform • FYERS API v3</p>
            </div>
          </div>

          {/* Status Badges & Controls */}
          <div className="flex items-center gap-1.5 md:gap-3">
            {/* Mode Indicator & Selector */}
            <div className="flex items-center bg-[#111827] border border-gray-800 rounded-lg p-0.5 md:p-1 text-[10px] md:text-xs">
              <button
                onClick={() => switchTradingMode('BACKTEST')}
                className={`hidden lg:inline-block px-2 py-1 font-semibold rounded transition-colors ${
                  currentMode === 'BACKTEST' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                BACKTEST
              </button>
              <button
                onClick={() => switchTradingMode('PAPER')}
                className={`px-1.5 md:px-2 py-0.5 md:py-1 font-semibold rounded transition-colors ${
                  currentMode === 'PAPER' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                PAPER
              </button>
              <button
                onClick={() => switchTradingMode('LIVE')}
                className={`px-1.5 md:px-2 py-0.5 md:py-1 font-semibold rounded transition-colors flex items-center gap-1 ${
                  currentMode === 'LIVE' ? 'bg-rose-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'
                }`}
              >
                LIVE
              </button>
            </div>

            {/* Auto Trading Bot Switch */}
            <button
              onClick={toggleBot}
              className={`flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border text-[10px] md:text-xs font-semibold transition-all ${
                isBotRunning
                  ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300 shadow-emerald-900/30'
                  : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              <Bot className={`w-3 h-3 md:w-3.5 md:h-3.5 ${isBotRunning ? 'text-emerald-400' : 'text-gray-500'}`} />
              <span className="hidden sm:inline">BOT: </span>
              <span>{isBotRunning ? 'ON' : 'OFF'}</span>
            </button>

            {/* Broker Status Pill */}
            <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-[#111827] border border-gray-800 text-[10px] md:text-xs shrink-0">
              <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isFyersConnected ? 'bg-emerald-500 animate-ping' : 'bg-gray-500'}`} />
              <span className="hidden sm:inline text-gray-400 font-medium">FYERS:</span>
              <span className={isFyersConnected ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>
                {isFyersConnected ? 'LIVE' : 'MOCK'}
              </span>
            </div>

            {/* Circuit Breaker / Kill Switch Button */}
            {isHalted ? (
              <button
                onClick={resetKillSwitch}
                className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-[10px] md:text-xs font-semibold cursor-pointer"
                title="Reset Circuit Breaker"
              >
                <RotateCcw className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            ) : (
              <button
                onClick={() => setKillModalOpen(true)}
                className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 text-[10px] md:text-xs font-semibold shrink-0 cursor-pointer"
                title="Emergency Kill Switch"
              >
                <Power className="w-3 h-3 md:w-3.5 md:h-3.5 text-rose-400" />
                <span className="hidden sm:inline">KILL</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Alert Bar if trading is halted */}
        {isHalted && (
          <div className="mt-2 py-1.5 px-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-200 text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">
                <strong>HALTED:</strong> {riskState?.haltReason || 'Circuit breaker active. New order placement is blocked.'}
              </span>
            </div>
            <button
              onClick={resetKillSwitch}
              className="underline hover:text-white font-medium ml-2 shrink-0 cursor-pointer"
            >
              Resume
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
