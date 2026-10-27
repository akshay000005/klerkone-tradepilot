/**
 * Explainable Signal Scoring Engine
 * 
 * Provides an objective, audited breakdown of every technical condition
 * evaluated for an instrument.
 * Note: Signal score represents condition conformance, NOT guaranteed probability of profit.
 */

export function buildExplainableSignal({
  symbol,
  strategy,
  candle,
  indicators,
  rules,
  parameters = {},
}) {
  const conditionsMet = [];
  const conditionsFailed = [];
  let score = 0;

  for (const rule of rules) {
    if (rule.condition) {
      conditionsMet.push({ name: rule.name, description: rule.description, weight: rule.weight });
      score += rule.weight;
    } else {
      conditionsFailed.push({ name: rule.name, description: rule.description, reason: rule.failReason });
    }
  }

  // Normalize score between 0 and 100
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));

  const isBuy = conditionsFailed.length === 0 && normalizedScore >= (parameters.minScore || 80);

  // Proposed Trade Parameters (using ATR for volatility-adjusted stop-loss)
  const currentPrice = Number(candle.close);
  const atr = indicators.atr || (currentPrice * 0.01);
  const slMultiplier = parameters.slMultiplier || 1.5;
  const targetMultiplier = parameters.targetMultiplier || 3.0;

  const stopLossDistance = Number((atr * slMultiplier).toFixed(2));
  const proposedStopLoss = Number((currentPrice - stopLossDistance).toFixed(2));
  const proposedTarget = Number((currentPrice + (atr * targetMultiplier)).toFixed(2));
  const riskPerShare = stopLossDistance;

  let rejectionReason = null;
  if (!isBuy) {
    rejectionReason = conditionsFailed.map((c) => `${c.name}: ${c.reason}`).join('; ');
  }

  return {
    symbol,
    strategy,
    signal_type: isBuy ? 'BUY' : 'NO_TRADE',
    candle_timestamp: candle.timestamp,
    indicator_snapshot: {
      price: currentPrice,
      emaFast: indicators.emaFast,
      emaSlow: indicators.emaSlow,
      rsi: indicators.rsi,
      rvol: indicators.rvol,
      atr: indicators.atr,
    },
    entry_price: isBuy ? currentPrice : null,
    stop_loss: isBuy ? proposedStopLoss : null,
    target_price: isBuy ? proposedTarget : null,
    risk_amount: isBuy ? riskPerShare : null,
    signal_score: normalizedScore,
    rejection_reason: rejectionReason,
    conditions_met: conditionsMet,
    conditions_failed: conditionsFailed,
    is_valid: isBuy,
  };
}
