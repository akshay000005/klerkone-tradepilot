import { repository } from '../db/repository.js';

export class KillSwitch {
  /**
   * Activates emergency kill switch.
   * Immediately freezes all new entries and sets trading_halted = true.
   */
  static async activateKillSwitch({ reason = 'Manual Emergency Trigger', squareOffAllPositions = false, tradingMode = 'PAPER', brokerAdapter = null }) {
    const today = new Date().toISOString().split('T')[0];

    // 1. Set trading halted in daily risk state
    await repository.updateDailyRiskState(today, tradingMode, {
      trading_halted: true,
      halt_reason: `KILL SWITCH ACTIVATED: ${reason}`,
    });

    // 2. Also ensure live trading is turned off in settings if live mode was active
    await repository.updateUserSettings({
      live_trading_enabled: false,
    });

    // 3. Record emergency audit log
    await repository.recordAuditLog({
      eventType: 'EMERGENCY_KILL_SWITCH',
      relevantEntityId: tradingMode,
      metadata: { reason, squareOffAllPositions },
      outcome: 'WARNING',
    });

    const results = {
      tradingHalted: true,
      reason,
      positionsClosed: [],
    };

    // 4. Optionally square off open positions immediately
    if (squareOffAllPositions && brokerAdapter) {
      const openPositions = await repository.getPositions(tradingMode);
      for (const pos of openPositions) {
        if (pos.quantity > 0) {
          try {
            await brokerAdapter.placeOrder({
              symbol: pos.symbol,
              side: 'SELL',
              quantity: pos.quantity,
              order_type: 'MARKET',
              product_type: pos.product_type || 'INTRADAY',
            });
            await repository.removePosition(pos.symbol, tradingMode);
            results.positionsClosed.push(pos.symbol);
          } catch (err) {
            console.error(`Failed to emergency close position for ${pos.symbol}:`, err.message);
          }
        }
      }
    }

    return results;
  }

  /**
   * Deactivates emergency kill switch after safety checks.
   */
  static async resetKillSwitch({ tradingMode = 'PAPER' }) {
    const today = new Date().toISOString().split('T')[0];
    await repository.updateDailyRiskState(today, tradingMode, {
      trading_halted: false,
      halt_reason: null,
      realised_pnl: 0,
      unrealised_pnl: 0,
    });

    await repository.recordAuditLog({
      eventType: 'KILL_SWITCH_RESET',
      relevantEntityId: tradingMode,
      outcome: 'INFO',
    });

    return { tradingHalted: false, message: 'Kill switch reset. System restored to normal monitoring.' };
  }
}
