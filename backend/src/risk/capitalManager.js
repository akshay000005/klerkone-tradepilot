/**
 * Dynamic Capital & Position Sizing Manager
 * Calculates whole-share order sizing based on effective capital and risk limits.
 */

export function calculateEffectiveCapital({
  verifiedAvailableFunds,
  userAllocatedCapital,
}) {
  const brokerFunds = Number(verifiedAvailableFunds);
  const userCap = Number(userAllocatedCapital);

  if (isNaN(brokerFunds) || brokerFunds <= 0) {
    return userCap;
  }
  return Math.min(brokerFunds, userCap);
}

export function calculatePositionSize({
  effectiveCapital,
  entryPrice,
  stopLossPrice,
  riskPerTradePercent = 0.5,
  maxCapitalUtilisationPercent = 50.0,
  currentDeployedCapital = 0,
}) {
  const effCap = Number(effectiveCapital);
  const entry = Number(entryPrice);
  const sl = Number(stopLossPrice);

  if (entry <= 0) {
    return { quantity: 0, isValid: false, reason: 'Invalid entry price (<= 0)' };
  }

  if (sl >= entry) {
    return { quantity: 0, isValid: false, reason: `Stop-loss (${sl}) must be strictly below entry price (${entry}) for long positions` };
  }

  const riskPerShare = Number((entry - sl).toFixed(2));
  if (riskPerShare <= 0) {
    return { quantity: 0, isValid: false, reason: 'Risk per share must be positive' };
  }

  // 1. Quantity based on permitted risk amount
  const maxRiskAmount = Number(((effCap * riskPerTradePercent) / 100).toFixed(2));
  const riskBasedQuantity = Math.floor(maxRiskAmount / riskPerShare);

  // 2. Quantity based on capital utilisation limits
  const totalAllowedCapital = (effCap * maxCapitalUtilisationPercent) / 100;
  const remainingDeployableCapital = Math.max(0, totalAllowedCapital - currentDeployedCapital);
  const capitalBasedQuantity = Math.floor(remainingDeployableCapital / entry);

  // Take the smaller quantity (conservative sizing)
  const proposedQuantity = Math.min(riskBasedQuantity, capitalBasedQuantity);

  if (proposedQuantity <= 0) {
    let reason = 'Calculated quantity is 0.';
    if (riskBasedQuantity <= 0) {
      reason += ` Stop-loss distance (${riskPerShare}) is too wide for permitted risk (₹${maxRiskAmount}).`;
    } else if (capitalBasedQuantity <= 0) {
      reason += ` Capital utilisation limit (₹${totalAllowedCapital}) reached.`;
    }
    return {
      quantity: 0,
      isValid: false,
      reason,
      riskPerShare,
      maxRiskAmount,
    };
  }

  const requiredCapital = Number((proposedQuantity * entry).toFixed(2));
  const plannedRisk = Number((proposedQuantity * riskPerShare).toFixed(2));

  return {
    quantity: proposedQuantity,
    isValid: true,
    entryPrice: entry,
    stopLossPrice: sl,
    riskPerShare,
    maxRiskAmount,
    plannedRisk,
    requiredCapital,
  };
}
