import { evaluateIntradayMomentum } from '../strategies/intradayMomentum.js';
import { evaluateSwingTrend } from '../strategies/swingTrend.js';
import { calculateIndianEquityCharges } from '../config/charges.js';
import { calculatePerformanceMetrics } from './metrics.js';

export function runBacktest({
  symbol = 'NSE:RELIANCE-EQ',
  candles = [],
  strategy = 'INTRADAY_MOMENTUM',
  strategyConfig = {},
  initialCapital = 50000,
  riskPerTradePercent = 0.5,
  maxCapitalUtilisationPercent = 50.0,
  slippagePercent = 0.05, // 0.05% realistic slippage
  productType = 'INTRADAY',
}) {
  if (!Array.isArray(candles) || candles.length < 50) {
    throw new Error(`Insufficient historical candles for backtest (minimum 50 required, received ${candles ? candles.length : 0})`);
  }

  let currentCapital = Number(initialCapital);
  let activePosition = null;
  const closedTrades = [];
  const equityCurve = [
    {
      timestamp: candles[0].timestamp,
      equity: currentCapital,
      drawdown: 0,
    },
  ];

  // Slippage factor
  const slipMultiplier = Number(slippagePercent) / 100;

  // Bar-by-bar chronological execution (strictly no future data access)
  for (let i = 49; i < candles.length; i++) {
    const historicalSlice = candles.slice(0, i + 1);
    const currentCandle = candles[i];

    // 1. Manage Active Position (Exits)
    if (activePosition) {
      let exitPrice = null;
      let exitReason = null;

      // Check Stop-loss hit (Low <= current_stop_loss)
      if (currentCandle.low <= activePosition.current_stop_loss) {
        exitPrice = activePosition.current_stop_loss * (1 - slipMultiplier); // Slippage against us on exit
        exitReason = 'STOP_LOSS';
      }
      // Check Target hit (High >= current_target)
      else if (currentCandle.high >= activePosition.current_target) {
        exitPrice = activePosition.current_target * (1 - slipMultiplier);
        exitReason = 'PROFIT_TARGET';
      }
      // Intraday session square-off at 15:15 or last candle of day
      else if (productType === 'INTRADAY' && isSessionClose(currentCandle.timestamp)) {
        exitPrice = currentCandle.close * (1 - slipMultiplier);
        exitReason = 'SESSION_CLOSE';
      }

      // If exit condition triggered, execute deal
      if (exitPrice !== null) {
        const charges = calculateIndianEquityCharges({
          buyPrice: activePosition.average_entry_price,
          sellPrice: exitPrice,
          quantity: activePosition.quantity,
          productType,
        });

        const netPnL = charges.netPnL;
        currentCapital = Number((currentCapital + netPnL).toFixed(2));

        closedTrades.push({
          symbol,
          strategy,
          entry_price: Number(activePosition.average_entry_price.toFixed(2)),
          exit_price: Number(exitPrice.toFixed(2)),
          quantity: activePosition.quantity,
          realised_pnl: netPnL,
          estimated_charges: charges.totalCharges,
          entry_timestamp: activePosition.entry_timestamp,
          exit_timestamp: currentCandle.timestamp,
          trading_mode: 'BACKTEST',
          exit_reason: exitReason,
        });

        equityCurve.push({
          timestamp: currentCandle.timestamp,
          equity: currentCapital,
          drawdown: 0,
        });

        activePosition = null;
      }
    }

    // 2. Evaluate Entry Signals (Only if no active position)
    if (!activePosition && i < candles.length - 1) {
      let signal;
      if (strategy === 'INTRADAY_MOMENTUM') {
        signal = evaluateIntradayMomentum(historicalSlice, strategyConfig);
      } else {
        signal = evaluateSwingTrend(historicalSlice, strategyConfig);
      }

      if (signal.is_valid && signal.signal_type === 'BUY') {
        // Calculate dynamic position size based on allocated risk
        const riskAmount = (currentCapital * (riskPerTradePercent / 100));
        const stopLossDistance = signal.risk_amount;

        if (stopLossDistance > 0) {
          let quantity = Math.floor(riskAmount / stopLossDistance);

          // Bound quantity by maximum capital utilisation
          const maxAllowedCapital = currentCapital * (maxCapitalUtilisationPercent / 100);
          const maxQuantityByCap = Math.floor(maxAllowedCapital / signal.entry_price);
          quantity = Math.min(quantity, maxQuantityByCap);

          if (quantity > 0) {
            // Apply slippage on entry (Buy fills slightly higher)
            const filledEntryPrice = signal.entry_price * (1 + slipMultiplier);

            activePosition = {
              symbol,
              strategy,
              quantity,
              average_entry_price: filledEntryPrice,
              current_stop_loss: signal.stop_loss,
              current_target: signal.target_price,
              entry_timestamp: currentCandle.timestamp,
              trading_mode: 'BACKTEST',
              productType,
            };
          }
        }
      }
    }
  }

  // Force close any remaining open position at end of backtest period
  if (activePosition) {
    const finalCandle = candles[candles.length - 1];
    const charges = calculateIndianEquityCharges({
      buyPrice: activePosition.average_entry_price,
      sellPrice: finalCandle.close,
      quantity: activePosition.quantity,
      productType,
    });
    currentCapital = Number((currentCapital + charges.netPnL).toFixed(2));
    closedTrades.push({
      symbol,
      strategy,
      entry_price: Number(activePosition.average_entry_price.toFixed(2)),
      exit_price: Number(finalCandle.close.toFixed(2)),
      quantity: activePosition.quantity,
      realised_pnl: charges.netPnL,
      estimated_charges: charges.totalCharges,
      entry_timestamp: activePosition.entry_timestamp,
      exit_timestamp: finalCandle.timestamp,
      trading_mode: 'BACKTEST',
      exit_reason: 'BACKTEST_END_SQUARE_OFF',
    });
    equityCurve.push({
      timestamp: finalCandle.timestamp,
      equity: currentCapital,
      drawdown: 0,
    });
  }

  const metrics = calculatePerformanceMetrics({
    initialCapital,
    trades: closedTrades,
    equityCurve,
  });

  return {
    symbol,
    strategy,
    productType,
    candleCount: candles.length,
    startDate: candles[0].timestamp,
    endDate: candles[candles.length - 1].timestamp,
    metrics,
    trades: closedTrades,
  };
}

function isSessionClose(timestamp) {
  try {
    const d = new Date(timestamp);
    const hours = d.getHours();
    const minutes = d.getMinutes();
    // 15:15 IST or later is intraday square off time
    return (hours === 15 && minutes >= 15) || hours > 15;
  } catch (err) {
    return false;
  }
}
