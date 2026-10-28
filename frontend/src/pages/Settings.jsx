import React, { useState, useEffect } from 'react';
import { useTrading } from '../context/TradingContext';
import { useToast } from '../context/ToastContext';
import { Shield, Key, AlertTriangle, ExternalLink, RefreshCw, FileText, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

export default function Settings() {
  const { settings, health, fetchSystemData, switchTradingMode, resetPaperSession } = useTrading();
  const { addToast } = useToast();

  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);

  // Optional AI test state
  const [newsHeadline, setNewsHeadline] = useState('Tata Motors announces record Q3 consolidated revenue and electric vehicle expansion');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzingNews, setAnalyzingNews] = useState(false);

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/v1/audit-logs?limit=50');
      const data = await res.json();
      setAuditLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const handleConnectFyers = async (mode = 'cloud') => {
    try {
      const res = await fetch(`/api/v1/broker/fyers/auth-url?mode=${mode}`);
      const data = await res.json();
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        addToast(`FYERS OAuth login opened (${mode === 'localhost' ? 'localhost fallback' : 'cloud'}). Authorize and return.`, 'info');
      } else {
        addToast(data.error || 'Failed to generate FYERS authorization URL. Check .env configuration.', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleManualTokenSubmit = async (e) => {
    e?.preventDefault();
    const raw = manualToken.trim();
    if (!raw) return;

    setSubmittingToken(true);
    try {
      let authCode = null;
      let token = null;

      // 1. If user pasted a full redirect URL, extract auth_code or code
      if (raw.includes('auth_code=') || raw.includes('code=')) {
        const match = raw.match(/(?:auth_code|code)=([^&]+)/);
        if (match) authCode = decodeURIComponent(match[1]);
      }

      // 2. If it's a JWT access token (usually contains two dots)
      if (!authCode) {
        if (raw.includes('.') && raw.split('.').length === 3) {
          token = raw;
        } else {
          authCode = raw;
        }
      }

      const payload = authCode ? { authCode } : { token };

      const res = await fetch('/api/v1/broker/fyers/manual-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'FYERS connected! Live NSE market data active.', 'success');
        setManualToken('');
        fetchSystemData();
      } else {
        addToast(data.error || 'Failed to verify token with FYERS', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmittingToken(false);
    }
  };

  const handleToggleLiveTrading = async () => {
    if (settings?.live_trading_enabled) {
      // Disable live trading immediately
      try {
        const res = await fetch('/api/v1/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ live_trading_enabled: false, trading_mode: 'PAPER' }),
        });
        if (res.ok) {
          addToast('Live trading disabled. System switched back to PAPER mode.', 'info');
          fetchSystemData();
        }
      } catch (err) {
        addToast(err.message, 'error');
      }
    } else {
      // Open verification modal
      setLiveConfirmOpen(true);
    }
  };

  const confirmEnableLiveTrading = async () => {
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ live_trading_enabled: true }),
      });
      if (res.ok) {
        addToast('Live trading gate unlocked. You can now select LIVE mode from the header.', 'warning', 8000);
        fetchSystemData();
      } else {
        const data = await res.json();
        addToast(data.error || 'Failed to activate live trading', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLiveConfirmOpen(false);
    }
  };

  const handleAnalyzeNews = async (e) => {
    e.preventDefault();
    setAnalyzingNews(true);
    try {
      const res = await fetch('/api/v1/ai/analyze-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: newsHeadline }),
      });
      const data = await res.json();
      setAiAnalysis(data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setAnalyzingNews(false);
    }
  };

  const fyersConfigured = health?.config?.FYERS_CONFIGURED;
  const fyersConnected = health?.brokerSessionStatus === 'CONNECTED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-xl bg-[#111827] border border-gray-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          Settings, Broker Authentication &amp; Security Gate
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Manage FYERS API v3 connectivity, strict live-trading authorization, and transparency audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. FYERS Broker Connection Card */}
        <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              FYERS Broker Integration (API v3)
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              fyersConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-800 text-gray-400'
            }`}>
              {fyersConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Credentials in .env</span>
              <span className={`font-semibold ${fyersConfigured ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fyersConfigured ? 'App ID & Secret Key Configured' : 'Missing in .env'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">OAuth Access Token</span>
              <span className={`font-semibold ${fyersConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {fyersConnected ? 'Active Daily Session' : 'No Active Session'}
              </span>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              FYERS OAuth tokens expire daily as per SEBI regulations. Launch login below to renew your daily session:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handleConnectFyers('cloud')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-indigo-900/30 cursor-pointer"
                title="Use if FYERS dashboard Redirect URL is set to klerkone-tradepilot.onrender.com"
              >
                <ExternalLink className="w-4 h-4" />
                1-Click Cloud Login
              </button>
              <button
                onClick={() => handleConnectFyers('localhost')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-semibold text-xs transition-colors cursor-pointer"
                title="Use if FYERS dashboard still has localhost:5000 registered"
              >
                <ExternalLink className="w-4 h-4" />
                Localhost Fallback Login
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span>FYERS Dashboard Redirect URL:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('https://klerkone-tradepilot.onrender.com/api/v1/broker/fyers/callback');
                    addToast('Redirect URL copied to clipboard!', 'info');
                  }}
                  className="text-indigo-400 hover:text-indigo-300 underline font-mono text-[10px] cursor-pointer"
                >
                  Copy URL
                </button>
              </div>
              <code className="text-gray-300 font-mono block text-[10px] break-all select-all">
                https://klerkone-tradepilot.onrender.com/api/v1/broker/fyers/callback
              </code>
              <a
                href="https://myapi.fyers.in"
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[10px] text-indigo-400 hover:underline pt-0.5"
              >
                Open FYERS Portal (myapi.fyers.in) &rarr;
              </a>
            </div>

            {/* Direct / Mobile Token Link */}
            <div className="pt-3 border-t border-gray-800 space-y-2">
              <label className="text-[11px] font-semibold text-gray-300 block">
                Mobile Remote Link / Direct Token Verification
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste FYERS Auth Code or Access Token..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                />
                <button
                  type="button"
                  disabled={submittingToken || !manualToken.trim()}
                  onClick={handleManualTokenSubmit}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer"
                >
                  {submittingToken ? 'Verifying...' : 'Save & Link'}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                On mobile: Complete FYERS login in browser, then copy the redirected URL or auth code and paste here to link instantly.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Live Trading Safety Gate (Milestone 8) */}
        <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Live Execution Safety Activation Gate
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              settings?.live_trading_enabled ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {settings?.live_trading_enabled ? 'LIVE UNLOCKED' : 'LOCKED (SAFE)'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-gray-300 leading-relaxed">
              <strong>Safety Invariant:</strong> Live trading is disabled by default upon every fresh server startup. Live order execution through FYERS requires satisfying all verification requirements below.
            </p>

            {/* Checklist */}
            <div className="space-y-2 p-3 rounded-lg bg-gray-900 border border-gray-800">
              <div className="flex items-center gap-2">
                {fyersConnected ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-gray-500" />}
                <span className={fyersConnected ? 'text-gray-200' : 'text-gray-500'}>Valid FYERS broker session active</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-gray-200">Pre-trade RiskGuardian 0.5% risk limits active</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-gray-200">1.5% Daily circuit breaker loss limit active</span>
              </div>
            </div>

            <button
              onClick={handleToggleLiveTrading}
              className={`w-full py-2.5 rounded-lg font-semibold transition-colors shadow-lg ${
                settings?.live_trading_enabled
                  ? 'bg-gray-800 hover:bg-gray-750 text-gray-200 border border-gray-700'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/30'
              }`}
            >
              {settings?.live_trading_enabled ? 'Lock Live Trading (Return to Safe Mode)' : 'Unlock Live Trading Gate...'}
            </button>
          </div>
        </div>
      </div>

      {/* 2B. Paper Trading Simulation & Circuit Breaker Reset */}
      <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              Paper Trading Simulator Management
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Reset virtual capital, clear paper positions/orders, and restore circuit breaker to start clean testing cycles.
            </p>
          </div>
          <button
            onClick={resetPaperSession}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer shadow-sm"
          >
            Reset Paper Trading &amp; Clear Halt
          </button>
        </div>
      </div>

      {/* 3. Optional AI Market Intelligence Test */}
      <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Optional AI Market Intelligence
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Natural language corporate announcement parsing. Decoupled from core quantitative execution rules.
            </p>
          </div>
          <span className="text-xs text-gray-500 font-mono">Provider: {health?.config?.AI_PROVIDER || 'mock'}</span>
        </div>

        <form onSubmit={handleAnalyzeNews} className="flex flex-col sm:flex-row gap-3 text-xs">
          <input
            type="text"
            value={newsHeadline}
            onChange={(e) => setNewsHeadline(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none"
          />
          <button
            type="submit"
            disabled={analyzingNews}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shrink-0"
          >
            {analyzingNews ? 'Analyzing...' : 'Analyze Sentiment'}
          </button>
        </form>

        {aiAnalysis && (
          <div className="p-4 rounded-lg bg-gray-900 border border-gray-800 space-y-2 text-xs">
            <div className="flex items-center gap-4">
              <span className="text-gray-400">Sentiment:</span>
              <span className={`font-bold ${
                aiAnalysis.sentiment === 'BULLISH' ? 'text-emerald-400' : aiAnalysis.sentiment === 'BEARISH' ? 'text-rose-400' : 'text-gray-300'
              }`}>
                {aiAnalysis.sentiment} (Score: {aiAnalysis.score})
              </span>
              <span className="text-gray-400">Impact: <strong className="text-white">{aiAnalysis.impact}</strong></span>
            </div>
            <div className="text-gray-300 italic">"{aiAnalysis.summary}"</div>
          </div>
        )}
      </div>

      {/* 4. Audit & Event Logs */}
      <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            System Audit &amp; Event Logs ({auditLogs.length})
          </h3>
          <button
            onClick={loadAuditLogs}
            disabled={loadingLogs}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-semibold uppercase sticky top-0">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Entity</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/40">
                  <td className="py-2 px-3 text-gray-400">{new Date(log.event_timestamp).toLocaleTimeString()}</td>
                  <td className="py-2 px-3 font-semibold text-gray-200">{log.event_type}</td>
                  <td className="py-2 px-3 text-gray-400">{log.relevant_entity_id || '-'}</td>
                  <td className="py-2 px-3">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      log.outcome === 'SUCCESS' ? 'text-emerald-400' : log.outcome === 'WARNING' ? 'text-amber-400' : 'text-gray-300'
                    }`}>
                      {log.outcome}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-500 truncate max-w-xs">{JSON.stringify(log.safe_metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Trading Warning Modal */}
      <ConfirmationModal
        isOpen={liveConfirmOpen}
        title="DANGER: LIVE TRADING ACTIVATION"
        message={
          <div className="space-y-3 text-xs leading-relaxed">
            <p className="text-rose-300 font-bold">
              CAUTION: You are about to authorize real capital broker order execution through FYERS.
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Stock trading involves significant risk of capital loss.</li>
              <li>Algorithmic strategies do not guarantee profits.</li>
              <li>All orders will execute against live market equity liquidity.</li>
              <li>Ensure your risk limits and capital allocation are double-checked.</li>
            </ul>
            <p className="text-gray-400">
              Do you want to proceed and unlock live trading capability?
            </p>
          </div>
        }
        confirmText="I Understand the Risks — Unlock Live Mode"
        confirmVariant="danger"
        onConfirm={confirmEnableLiveTrading}
        onCancel={() => setLiveConfirmOpen(false)}
      />
    </div>
  );
}
