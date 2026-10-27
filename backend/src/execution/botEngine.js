import { repository } from '../db/repository.js';
import { OrderManager } from './orderManager.js';
import { evaluateIntradayMomentum } from '../strategies/intradayMomentum.js';
import { evaluateSwingTrend } from '../strategies/swingTrend.js';

export class AutonomousBotEngine {
  constructor({ getBrokerAdapter }) {
    this.getBrokerAdapter = getBrokerAdapter;
    this.isRunning = false;
    this.intervalId = null;
    this.cycleIntervalMs = 10000; // 10-second heartbeat cycle
    this.lastRunTime = null;
    this.totalAutoTrades = 0;
    this.lastLogMessage = 'Bot initialized in standby mode.';
    this.symbolCooldowns = new Map();
  }

  start() {
    if (this.isRunning) return { success: true, message: 'Autonomous Bot is already running.' };

    this.isRunning = true;
    this.lastLogMessage = 'Autonomous Bot started. Continuous scanning & auto-execution active.';
    console.log('🤖 [TradePilot Bot] Autonomous Trading Engine STARTED.');

    // Execute first cycle immediately, then every interval
    this._executeCycle().catch((err) => console.error('Bot cycle error:', err));
    this.intervalId = setInterval(() => {
      this._executeCycle().catch((err) => console.error('Bot cycle error:', err));
    }, this.cycleIntervalMs);

    return { success: true, message: 'Autonomous Trading Bot is now ACTIVE.' };
  }

  stop() {
    if (!this.isRunning) return { success: true, message: 'Autonomous Bot is already stopped.' };

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.lastLogMessage = 'Autonomous Bot stopped by user.';
    console.log('🛑 [TradePilot Bot] Autonomous Trading Engine STOPPED.');
    return { success: true, message: 'Autonomous Trading Bot is now STOPPED.' };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      totalAutoTrades: this.totalAutoTrades,
      cycleIntervalMs: this.cycleIntervalMs,
      lastLogMessage: this.lastLogMessage,
    };
  }

  async _executeCycle() {
    if (!this.isRunning) return;

    this.lastRunTime = new Date().toISOString();
    const settings = await repository.getUserSettings();
    const mode = settings.trading_mode || 'PAPER';
    const broker = this.getBrokerAdapter(mode);
    const orderManager = new OrderManager({ brokerAdapter: broker });

    // Check circuit breaker halt
    const today = new Date().toISOString().split('T')[0];
    const riskState = await repository.getDailyRiskState(today, mode);
    if (riskState.trading_halted) {
      this.lastLogMessage = `Bot paused: Trading is halted (${riskState.halt_reason})`;
      return;
    }

    // In LIVE mode, strictly respect NSE Indian market trading hours (9:15 AM - 3:30 PM IST, Mon-Fri)
    if (mode === 'LIVE' && !this._isMarketOpenSession()) {
      const ist = this._getISTTime();
      this.lastLogMessage = `NSE Equity Market is closed. Auto-bot will activate at 09:15 AM IST (Mon-Fri). Current IST: ${String(ist.hours).padStart(2, '0')}:${String(ist.minutes).padStart(2, '0')}`;
      return;
    }

    const openPositions = await repository.getPositions(mode);

    // =========================================================================
    // PHASE 1: AUTOMATIC POSITION MANAGEMENT & AUTO-SALES (EXITS)
    // =========================================================================
    for (const pos of openPositions) {
      if (pos.quantity <= 0) continue;

      try {
        const quotes = await broker.getQuotes([pos.symbol]);
        const quoteObj = quotes.find((q) => q.n === pos.symbol || q.v?.symbol === pos.symbol);
        const ltp = quoteObj?.v?.lp || quoteObj?.lp || pos.current_market_price || pos.average_entry_price;

        // Update unrealised P&L in position record
        const unPnl = Number(((ltp - pos.average_entry_price) * pos.quantity).toFixed(2));
        await repository.upsertPosition({
          ...pos,
          current_market_price: ltp,
          unrealised_pnl: unPnl,
        });

        let exitReason = null;

        // 1. Check Stop-Loss
        if (pos.current_stop_loss && ltp <= Number(pos.current_stop_loss)) {
          exitReason = `AUTO_STOP_LOSS (LTP ₹${ltp} <= SL ₹${pos.current_stop_loss})`;
        }
        // 2. Check Target Profit
        else if (pos.current_target && ltp >= Number(pos.current_target)) {
          exitReason = `AUTO_TARGET_PROFIT (LTP ₹${ltp} >= Target ₹${pos.current_target})`;
        }
        // 3. Check Intraday Mandatory 3:15 PM Square-off (IST)
        else if (pos.product_type === 'INTRADAY' && this._isMarketCloseSquareOffWindow()) {
          exitReason = 'AUTO_INTRADAY_SQUARE_OFF (15:15 IST)';
        }

        // Execute Auto-Sale if condition triggered
        if (exitReason) {
          console.log(`🚨 [TradePilot Bot] Triggering AUTO-SALE for ${pos.symbol}: ${exitReason}`);
          const exitResult = await orderManager.submitOrder({
            symbol: pos.symbol,
            side: 'SELL',
            quantity: pos.quantity,
            price: ltp,
            orderType: 'MARKET',
            productType: pos.product_type || 'INTRADAY',
            tradingMode: mode,
            strategy: pos.strategy,
          });

          if (exitResult.success) {
            this.totalAutoTrades++;
            this.symbolCooldowns.set(pos.symbol, Date.now() + 60000); // 1-minute cooldown per symbol after exit
            this.lastLogMessage = `Auto-Sold ${pos.quantity} shares of ${pos.symbol} at ₹${exitResult.tradedPrice}. Reason: ${exitReason}`;
            await repository.recordAuditLog({
              eventType: 'AUTO_BOT_SALE',
              relevantEntityId: pos.symbol,
              metadata: { quantity: pos.quantity, price: exitResult.tradedPrice, reason: exitReason },
              outcome: 'SUCCESS',
            });
          }
        }
      } catch (err) {
        console.error(`Error in position monitor for ${pos.symbol}:`, err.message);
      }
    }

    // =========================================================================
    // PHASE 2: AUTOMATIC SCANNING & AUTO-PURCHASE (ENTRIES)
    // =========================================================================
    // Only search for new entries if position slots are available
    const freshPositions = await repository.getPositions(mode);
    if (freshPositions.length >= settings.maximum_open_positions) {
      this.lastLogMessage = `Monitoring ${freshPositions.length} active positions. Max positions cap (${settings.maximum_open_positions}) reached.`;
      return;
    }

    const watchlist = await repository.getWatchlist();
    const enabledSymbols = watchlist.filter((w) => w.enabled);

    for (const item of enabledSymbols) {
      // Don't duplicate if already holding this symbol
      if (freshPositions.some((p) => p.symbol === item.symbol)) continue;

      // Check symbol trade cooldown
      const cooldownUntil = this.symbolCooldowns.get(item.symbol);
      if (cooldownUntil && Date.now() < cooldownUntil) continue;

      try {
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

        // If signal meets technical criteria (score >= 80% and BUY signal)
        if (signal.is_valid && signal.signal_type === 'BUY' && signal.signal_score >= 80) {
          console.log(`🎯 [TradePilot Bot] Signal detected for ${item.symbol}! Score: ${signal.signal_score}%. Submitting AUTO-BUY...`);

          const buyResult = await orderManager.submitOrder({
            symbol: item.symbol,
            side: 'BUY',
            quantity: signal.suggested_quantity || 10,
            price: signal.entry_price,
            stopLoss: signal.stop_loss,
            targetPrice: signal.target_price,
            orderType: 'MARKET',
            productType: item.strategy === 'SWING_TREND' ? 'CNC' : 'INTRADAY',
            tradingMode: mode,
            strategy: item.strategy,
          });

          if (buyResult.success) {
            this.totalAutoTrades++;
            this.symbolCooldowns.set(item.symbol, Date.now() + 60000); // 1-minute cooldown per symbol after entry
            this.lastLogMessage = `Auto-Bought ${buyResult.filledQuantity} shares of ${item.symbol} at ₹${buyResult.tradedPrice}. Score: ${signal.signal_score}%`;
            await repository.recordAuditLog({
              eventType: 'AUTO_BOT_PURCHASE',
              relevantEntityId: item.symbol,
              metadata: { quantity: buyResult.filledQuantity, price: buyResult.tradedPrice, signal },
              outcome: 'SUCCESS',
            });
            break; // Max 1 new entry per cycle to avoid batch surges
          }
        }
      } catch (err) {
        console.error(`Error scanning ${item.symbol} in bot cycle:`, err.message);
      }
    }
  }

  _getISTTime() {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const ist = new Date(istString);
    return {
      date: ist,
      day: ist.getDay(), // 0: Sunday, 1: Monday, ..., 5: Friday, 6: Saturday
      hours: ist.getHours(),
      minutes: ist.getMinutes(),
      totalMinutes: ist.getHours() * 60 + ist.getMinutes(),
    };
  }

  _isMarketOpenSession() {
    const ist = this._getISTTime();
    // Monday (1) through Friday (5) only
    if (ist.day < 1 || ist.day > 5) return false;
    // 09:15 AM (555 mins) to 03:30 PM (930 mins)
    return ist.totalMinutes >= 555 && ist.totalMinutes <= 930;
  }

  _isMarketCloseSquareOffWindow() {
    const ist = this._getISTTime();
    if (ist.day < 1 || ist.day > 5) return false;
    // Mandatory intraday square-off strictly between 3:15 PM (915 mins) and 3:30 PM (930 mins)
    return ist.totalMinutes >= 915 && ist.totalMinutes <= 930;
  }
}
