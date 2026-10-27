import { repository } from '../db/repository.js';

export class RiskGuardian {
  /**
   * Pre-trade safety inspection.
   * Rejects order if any risk limit or safety invariant is violated.
   */
  static async validatePreTrade({
    orderRequest,
    tradingMode,
    settings,
    positions = [],
    dailyRiskState,
  }) {
    // 1. Trading Halted / Kill Switch Check
    if (dailyRiskState.trading_halted) {
      return {
        allowed: false,
        reason: `Trading is currently halted. Reason: ${dailyRiskState.halt_reason || 'Emergency Kill Switch Triggered'}`,
        code: 'TRADING_HALTED',
      };
    }

    // 2. Daily Loss Limit Check
    const totalDailyPnL = Number(dailyRiskState.realised_pnl) + Number(dailyRiskState.unrealised_pnl);
    const lossLimitAmount = Number(dailyRiskState.daily_loss_limit);

    if (totalDailyPnL <= -lossLimitAmount) {
      // Trigger automatic circuit breaker halt for the rest of today
      await repository.updateDailyRiskState(dailyRiskState.trading_date, tradingMode, {
        trading_halted: true,
        halt_reason: `Daily loss limit breached: Total P&L ₹${totalDailyPnL.toFixed(2)} exceeded maximum allowable loss ₹${lossLimitAmount.toFixed(2)}`,
      });

      await repository.recordAuditLog({
        eventType: 'CIRCUIT_BREAKER_TRIGGERED',
        relevantEntityId: orderRequest.symbol,
        metadata: { totalDailyPnL, lossLimitAmount },
        outcome: 'WARNING',
      });

      return {
        allowed: false,
        reason: `Daily loss limit breached (Loss: ₹${Math.abs(totalDailyPnL).toFixed(2)}, Limit: ₹${lossLimitAmount.toFixed(2)}). New entries blocked.`,
        code: 'DAILY_LOSS_LIMIT_BREACHED',
      };
    }

    // If order is an EXIT / SELL, allow it to reduce risk regardless of position limits
    if (orderRequest.side === 'SELL') {
      const existingPos = positions.find((p) => p.symbol === orderRequest.symbol && p.trading_mode === tradingMode);
      if (!existingPos) {
        return {
          allowed: false,
          reason: `Cannot place SELL order for ${orderRequest.symbol}: No open position exists. Short selling is disabled.`,
          code: 'NO_OPEN_POSITION_FOR_EXIT',
        };
      }
      if (orderRequest.quantity > existingPos.quantity) {
        return {
          allowed: false,
          reason: `Exit quantity (${orderRequest.quantity}) exceeds position holding (${existingPos.quantity}). Over-selling prevented.`,
          code: 'OVERSELL_PREVENTED',
        };
      }
      return { allowed: true };
    }

    // 3. Maximum Open Positions Check (For BUY entries)
    const currentOpenPositions = positions.filter((p) => p.quantity > 0 && p.trading_mode === tradingMode);
    if (currentOpenPositions.length >= settings.maximum_open_positions) {
      // Check if position already exists for this symbol (prevent duplicate pyramid unless configured)
      const alreadyOpen = currentOpenPositions.some((p) => p.symbol === orderRequest.symbol);
      if (alreadyOpen) {
        return {
          allowed: false,
          reason: `Position already open for ${orderRequest.symbol}. Duplicate entries prevented.`,
          code: 'DUPLICATE_POSITION_PREVENTED',
        };
      }
      return {
        allowed: false,
        reason: `Maximum open positions limit (${settings.maximum_open_positions}) reached. Currently open: ${currentOpenPositions.length}.`,
        code: 'MAX_POSITIONS_REACHED',
      };
    }

    // 4. Capital Utilisation Limit Check
    const currentDeployedCapital = currentOpenPositions.reduce(
      (sum, p) => sum + (p.quantity * p.average_entry_price),
      0
    );
    const newOrderValue = orderRequest.quantity * (orderRequest.price || 0);
    const totalAllocatedCapital = Number(settings.allocated_capital);
    const maxAllowedCapital = (totalAllocatedCapital * Number(settings.maximum_capital_utilisation)) / 100;

    if (currentDeployedCapital + newOrderValue > maxAllowedCapital) {
      return {
        allowed: false,
        reason: `Capital utilisation limit exceeded: Order value ₹${newOrderValue.toFixed(2)} + Deployed ₹${currentDeployedCapital.toFixed(2)} exceeds cap ₹${maxAllowedCapital.toFixed(2)} (${settings.maximum_capital_utilisation}%).`,
        code: 'CAPITAL_UTILISATION_EXCEEDED',
      };
    }

    // 5. Live Mode Verification Gate
    if (tradingMode === 'LIVE') {
      if (!settings.live_trading_enabled) {
        return {
          allowed: false,
          reason: 'Live trading execution is disabled in system settings. Enable live mode explicitly in Settings.',
          code: 'LIVE_TRADING_DISABLED',
        };
      }
    }

    return { allowed: true };
  }
}
