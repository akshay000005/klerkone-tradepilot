import express from 'express';
import { repository } from '../db/repository.js';
import { getRedactedConfig } from '../config/env.js';
import { MockBrokerAdapter } from '../broker/mock/mockBroker.js';
import { FyersAdapter } from '../broker/fyers/client.js';
import { generateFyersAuthUrl, exchangeAuthCodeForToken, isTokenValid, setActiveToken } from '../broker/fyers/auth.js';
import { OrderManager } from '../execution/orderManager.js';
import { KillSwitch } from '../risk/killSwitch.js';
import { runBacktest } from '../backtest/engine.js';
import { runSensitivityAnalysis } from '../backtest/sensitivity.js';
import { evaluateIntradayMomentum } from '../strategies/intradayMomentum.js';
import { evaluateSwingTrend } from '../strategies/swingTrend.js';
import { NewsAnalyzer } from '../ai/newsAnalyzer.js';
import { AutonomousBotEngine } from '../execution/botEngine.js';

const router = express.Router();

// Active adapters
const fyersBroker = new FyersAdapter();
const mockBroker = new MockBrokerAdapter({
  getLiveBroker: () => (isTokenValid() ? fyersBroker : null),
});

function getActiveBroker(mode) {
  // Mode C (LIVE) uses FYERS adapter when configured, otherwise mock
  if (mode === 'LIVE' && isTokenValid()) {
    return fyersBroker;
  }
  return mockBroker;
}

// Autonomous Bot Engine
const botEngine = new AutonomousBotEngine({ getBrokerAdapter: getActiveBroker });

// ------------------------------------------------------------------------------
// 1. HEALTH & SYSTEM OVERVIEW
// ------------------------------------------------------------------------------
router.get('/health', async (req, res) => {
  try {
    const settings = await repository.getUserSettings();
    const today = new Date().toISOString().split('T')[0];
    const riskState = await repository.getDailyRiskState(today, settings.trading_mode);
    const brokerSession = await repository.getBrokerSession();

    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      tradingMode: settings.trading_mode,
      liveTradingEnabled: settings.live_trading_enabled,
      tradingHalted: riskState.trading_halted,
      haltReason: riskState.halt_reason,
      supabaseConnected: repository.isSupabaseConnected(),
      brokerSessionStatus: isTokenValid() ? 'CONNECTED' : brokerSession.session_status,
      botStatus: botEngine.getStatus(),
      config: getRedactedConfig(),
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// ------------------------------------------------------------------------------
// 2. USER SETTINGS
// ------------------------------------------------------------------------------
router.get('/settings', async (req, res) => {
  try {
    const settings = await repository.getUserSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const updates = req.body;
    // Safety check: Prevent switching to LIVE if live_trading_enabled is false
    if (updates.trading_mode === 'LIVE' && !updates.live_trading_enabled) {
      return res.status(400).json({
        error: 'Cannot switch to LIVE trading mode without explicitly activating live_trading_enabled.',
      });
    }

    const updated = await repository.updateUserSettings(updates);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 3. WATCHLIST
// ------------------------------------------------------------------------------
router.get('/watchlist', async (req, res) => {
  try {
    const list = await repository.getWatchlist();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/watchlist', async (req, res) => {
  try {
    const { symbol, exchange, strategy } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
    const record = await repository.addWatchlistSymbol({ symbol, exchange, strategy });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/watchlist/:symbol', async (req, res) => {
  try {
    await repository.removeWatchlistSymbol(decodeURIComponent(req.params.symbol));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/watchlist/:symbol/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    const updated = await repository.toggleWatchlistSymbol(decodeURIComponent(req.params.symbol), enabled);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 4. MARKET SCANNER & SIGNALS
// ------------------------------------------------------------------------------
router.get('/scanner', async (req, res) => {
  try {
    const settings = await repository.getUserSettings();
    const watchlist = await repository.getWatchlist();
    const activeSymbols = watchlist.filter((w) => w.enabled);
    const broker = getActiveBroker(settings.trading_mode);

    // Fetch quotes for active symbols
    const symbolsList = activeSymbols.map((s) => s.symbol);
    const quotes = await broker.getQuotes(symbolsList);

    // Evaluate signals for each symbol
    const scannerResults = [];
    for (const item of activeSymbols) {
      const q = quotes.find((quote) => quote.n === item.symbol || quote.v?.symbol === item.symbol)?.v || {
        lp: 1000,
        ch: 0,
        chp: 0,
        high_price: 1010,
        low_price: 990,
        volume: 50000,
      };

      // Get historical candles
      const candles = await broker.getHistoricalData({
        symbol: item.symbol,
        resolution: '5',
      });

      let signal;
      if (item.strategy === 'SWING_TREND') {
        signal = evaluateSwingTrend(candles);
      } else {
        signal = evaluateIntradayMomentum(candles);
      }

      scannerResults.push({
        symbol: item.symbol,
        exchange: item.exchange,
        strategy: item.strategy,
        ltp: q.lp,
        change: q.ch,
        changePercent: q.chp,
        high: q.high_price,
        low: q.low_price,
        volume: q.volume,
        signal,
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      results: scannerResults,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 5. POSITIONS
// ------------------------------------------------------------------------------
router.get('/positions', async (req, res) => {
  try {
    const mode = req.query.mode || null;
    const positions = await repository.getPositions(mode);
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/positions/exit', async (req, res) => {
  try {
    const { symbol, tradingMode = 'PAPER', reason = 'MANUAL_DASHBOARD_EXIT' } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required for exit' });

    const pos = await repository.getPosition(symbol, tradingMode);
    if (!pos || pos.quantity <= 0) {
      return res.status(404).json({ error: `No active position found for ${symbol} in ${tradingMode} mode.` });
    }

    const broker = getActiveBroker(tradingMode);
    const orderManager = new OrderManager({ brokerAdapter: broker });

    // Place exit order (SELL for long position)
    const result = await orderManager.submitOrder({
      symbol,
      side: 'SELL',
      quantity: pos.quantity,
      orderType: 'MARKET',
      productType: pos.product_type || 'INTRADAY',
      tradingMode,
      strategy: pos.strategy,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 6. ORDERS & TRADES
// ------------------------------------------------------------------------------
router.get('/orders', async (req, res) => {
  try {
    const mode = req.query.mode || null;
    const orders = await repository.getOrders(mode);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const orderData = req.body;
    const settings = await repository.getUserSettings();
    const mode = orderData.tradingMode || settings.trading_mode;

    const broker = getActiveBroker(mode);
    const orderManager = new OrderManager({ brokerAdapter: broker });

    const result = await orderManager.submitOrder({
      ...orderData,
      tradingMode: mode,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/trades', async (req, res) => {
  try {
    const mode = req.query.mode || null;
    const trades = await repository.getTrades(mode);
    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 7. RISK STATE & EMERGENCY CONTROLS
// ------------------------------------------------------------------------------
router.get('/risk/state', async (req, res) => {
  try {
    const settings = await repository.getUserSettings();
    const mode = req.query.mode || settings.trading_mode;
    const today = new Date().toISOString().split('T')[0];
    const riskState = await repository.getDailyRiskState(today, mode);
    const positions = await repository.getPositions(mode);

    const deployedCapital = positions.reduce((sum, p) => sum + (p.quantity * p.average_entry_price), 0);
    const openRisk = positions.reduce((sum, p) => {
      const riskPerShare = p.current_stop_loss ? Math.max(0, p.average_entry_price - p.current_stop_loss) : 0;
      return sum + (p.quantity * riskPerShare);
    }, 0);

    res.json({
      date: today,
      tradingMode: mode,
      startingCapital: riskState.starting_capital,
      realisedPnL: riskState.realised_pnl,
      unrealisedPnL: riskState.unrealised_pnl,
      totalPnL: Number((Number(riskState.realised_pnl) + Number(riskState.unrealised_pnl)).toFixed(2)),
      dailyLossLimitAmount: riskState.daily_loss_limit,
      tradingHalted: riskState.trading_halted,
      haltReason: riskState.halt_reason,
      openPositionsCount: positions.length,
      deployedCapital: Number(deployedCapital.toFixed(2)),
      openRisk: Number(openRisk.toFixed(2)),
      capitalUtilisationPercent: riskState.starting_capital > 0 ? Number(((deployedCapital / riskState.starting_capital) * 100).toFixed(2)) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/risk/kill-switch', async (req, res) => {
  try {
    const { reason, squareOffAllPositions, tradingMode = 'PAPER' } = req.body;
    const broker = getActiveBroker(tradingMode);
    const result = await KillSwitch.activateKillSwitch({
      reason,
      squareOffAllPositions,
      tradingMode,
      brokerAdapter: broker,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/risk/reset-kill-switch', async (req, res) => {
  try {
    const { tradingMode = 'PAPER' } = req.body;
    const result = await KillSwitch.resetKillSwitch({ tradingMode });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 7B. AUTONOMOUS BOT ENGINE CONTROLS
// ------------------------------------------------------------------------------
router.get('/bot/status', (req, res) => {
  res.json(botEngine.getStatus());
});

router.post('/bot/start', (req, res) => {
  res.json(botEngine.start());
});

router.post('/bot/stop', (req, res) => {
  res.json(botEngine.stop());
});

router.post('/bot/toggle', (req, res) => {
  if (botEngine.isRunning) {
    res.json(botEngine.stop());
  } else {
    res.json(botEngine.start());
  }
});

// ------------------------------------------------------------------------------
// 8. BACKTESTING & SENSITIVITY
// ------------------------------------------------------------------------------
router.post('/backtest/run', async (req, res) => {
  try {
    const {
      symbol = 'NSE:RELIANCE-EQ',
      strategy = 'INTRADAY_MOMENTUM',
      strategyConfig = {},
      initialCapital = 50000,
      riskPerTradePercent = 0.5,
      slippagePercent = 0.05,
    } = req.body;

    // Fetch candles from broker adapter
    const candles = await mockBroker.getHistoricalData({ symbol, resolution: '5' });

    const result = runBacktest({
      symbol,
      candles,
      strategy,
      strategyConfig,
      initialCapital,
      riskPerTradePercent,
      slippagePercent,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/backtest/sensitivity', async (req, res) => {
  try {
    const { symbol = 'NSE:RELIANCE-EQ', strategy = 'INTRADAY_MOMENTUM', baseConfig = {}, initialCapital = 50000 } = req.body;
    const candles = await mockBroker.getHistoricalData({ symbol, resolution: '5' });

    const result = runSensitivityAnalysis({
      symbol,
      candles,
      strategy,
      baseConfig,
      initialCapital,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 9. FYERS BROKER AUTH & SESSIONS
// ------------------------------------------------------------------------------
router.get('/broker/fyers/auth-url', (req, res) => {
  try {
    const authUrl = generateFyersAuthUrl({});
    res.json({ authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/broker/fyers/callback', async (req, res) => {
  try {
    const authCode = req.query.auth_code || req.query.code;
    if (!authCode) {
      return res.status(400).send('Authorization code missing in callback parameters: ' + JSON.stringify(req.query));
    }

    const { accessToken } = await exchangeAuthCodeForToken({ authCode });
    await repository.updateBrokerSession({
      session_status: 'CONNECTED',
    });

    res.send(`
      <html>
        <body style="font-family: sans-serif; background: #0b0f19; color: #10b981; text-align: center; padding-top: 50px;">
          <h2>FYERS OAuth Session Connected Successfully!</h2>
          <p style="color: #9ca3af;">Access token exchanged and verified. You may return to the TradePilot dashboard.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Authentication error: ${err.message}`);
  }
});

router.post('/broker/fyers/manual-token', async (req, res) => {
  try {
    let { token, authCode } = req.body;
    if (!token && !authCode) {
      return res.status(400).json({ error: 'Either an access token or an authorization code must be provided.' });
    }

    const raw = (authCode || token || '').trim();
    if (raw.includes('auth_code=') || raw.includes('code=')) {
      const match = raw.match(/(?:auth_code|code)=([^&]+)/);
      if (match) {
        authCode = decodeURIComponent(match[1]);
        token = null;
      }
    }

    if (authCode) {
      await exchangeAuthCodeForToken({ authCode: authCode.trim() });
    } else if (token) {
      setActiveToken(token.trim());
    }

    // Verify token with FYERS profile
    const profile = await fyersBroker.getProfile();
    await repository.updateBrokerSession({
      session_status: 'CONNECTED',
    });

    await repository.recordAuditLog({
      eventType: 'FYERS_TOKEN_CONNECTED',
      relevantEntityId: profile?.data?.fy_id || 'FYERS_USER',
      metadata: { name: profile?.data?.name },
      outcome: 'SUCCESS',
    });

    res.json({
      success: true,
      profile: profile?.data || null,
      message: 'FYERS API v3 session verified & connected! Real live NSE market data is now active.',
    });
  } catch (err) {
    res.status(400).json({ error: `FYERS verification failed: ${err.message}` });
  }
});

router.post('/paper/reset', async (req, res) => {
  try {
    mockBroker.resetStore();
    const result = await repository.resetPaperTrading();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 10. AUDIT LOGS & OPTIONAL AI
// ------------------------------------------------------------------------------
router.get('/audit-logs', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const logs = await repository.getAuditLogs(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/analyze-news', async (req, res) => {
  try {
    const { headline, source, publishedAt } = req.body;
    const analysis = await NewsAnalyzer.analyzeNewsItem({ headline, source, publishedAt });
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/explain-trade', async (req, res) => {
  try {
    const { symbol, ltp, signal, snapshot } = req.body;
    const explanation = await NewsAnalyzer.generateTradeExplanation({ symbol, ltp, signal, snapshot });
    res.json(explanation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as apiRouter };
