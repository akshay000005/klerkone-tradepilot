import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastContext';

const TradingContext = createContext(null);

export function TradingProvider({ children }) {
  const { addToast } = useToast();
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState(null);
  const [riskState, setRiskState] = useState(null);
  const [positions, setPositions] = useState([]);
  const [botStatus, setBotStatus] = useState({ isRunning: false, totalAutoTrades: 0, lastLogMessage: 'Standby' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchSystemData = useCallback(async () => {
    try {
      const [hRes, sRes, rRes, pRes, bRes] = await Promise.all([
        fetch('/api/v1/health').then((r) => r.json()),
        fetch('/api/v1/settings').then((r) => r.json()),
        fetch('/api/v1/risk/state').then((r) => r.json()),
        fetch('/api/v1/positions').then((r) => r.json()),
        fetch('/api/v1/bot/status').then((r) => r.json()).catch(() => ({ isRunning: false })),
      ]);

      setHealth(hRes);
      setSettings(sRes);
      setRiskState(rRes);
      setPositions(Array.isArray(pRes) ? pRes : []);
      if (bRes) setBotStatus(bRes);
    } catch (err) {
      console.error('Failed to sync trading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleBot = async () => {
    try {
      const res = await fetch('/api/v1/bot/toggle', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message, data.success ? 'success' : 'info');
        fetchSystemData();
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Poll state every 3.5 seconds with real-time WebSocket enhancement
  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 3500);

    let ws = null;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TICK_UPDATE' || msg.type === 'ORDER_UPDATE' || msg.type === 'POSITION_UPDATE') {
            fetchSystemData();
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      clearInterval(interval);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [fetchSystemData]);

  const switchTradingMode = async (targetMode) => {
    // Safety guard: Prevent mode switch if positions are open
    if (positions.length > 0) {
      addToast(`Cannot switch trading mode while ${positions.length} position(s) are open. Square off first.`, 'error');
      return false;
    }

    if (targetMode === 'LIVE' && !settings?.live_trading_enabled) {
      addToast('Live trading is disabled. Enable it in Settings first with verification.', 'warning');
      return false;
    }

    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trading_mode: targetMode }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
        addToast(`Trading mode switched to ${targetMode}`, 'success');
        fetchSystemData();
        return true;
      } else {
        addToast(data.error || 'Failed to switch mode', 'error');
        return false;
      }
    } catch (err) {
      addToast(err.message, 'error');
      return false;
    }
  };

  const triggerKillSwitch = async (squareOffAll = false) => {
    try {
      const res = await fetch('/api/v1/risk/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Manual Emergency Trigger from Dashboard',
          squareOffAllPositions: squareOffAll,
          tradingMode: settings?.trading_mode || 'PAPER',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`EMERGENCY KILL SWITCH ACTIVATED! Trading is halted.`, 'error', 8000);
        fetchSystemData();
        return true;
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
    return false;
  };

  const resetKillSwitch = async () => {
    try {
      const res = await fetch('/api/v1/risk/reset-kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradingMode: settings?.trading_mode || 'PAPER' }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Kill switch deactivated.', 'success');
        fetchSystemData();
        return true;
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
    return false;
  };

  const resetPaperSession = async () => {
    try {
      const res = await fetch('/api/v1/paper/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Paper trading session & circuit breaker reset successfully.', 'success');
        fetchSystemData();
        return true;
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
    return false;
  };

  return (
    <TradingContext.Provider
      value={{
        health,
        settings,
        riskState,
        positions,
        botStatus,
        toggleBot,
        loading,
        activeTab,
        setActiveTab,
        fetchSystemData,
        switchTradingMode,
        triggerKillSwitch,
        resetKillSwitch,
        resetPaperSession,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
}

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) throw new Error('useTrading must be used within TradingProvider');
  return context;
};
