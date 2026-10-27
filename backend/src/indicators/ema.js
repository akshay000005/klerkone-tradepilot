/**
 * Exponential Moving Average (EMA)
 * Formula: EMA_today = (Price_today * Multiplier) + (EMA_yesterday * (1 - Multiplier))
 * Multiplier = 2 / (period + 1)
 */

export function calculateEMA(values, period) {
  if (!Array.isArray(values) || values.length === 0 || period <= 0) {
    return [];
  }

  const results = new Array(values.length).fill(null);
  if (values.length < period) {
    return results;
  }

  const multiplier = 2 / (period + 1);

  // Initial seed is SMA of first 'period' values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += Number(values[i]);
  }
  let currentEMA = sum / period;
  results[period - 1] = Number(currentEMA.toFixed(4));

  // Compute remaining values
  for (let i = period; i < values.length; i++) {
    const price = Number(values[i]);
    currentEMA = (price - currentEMA) * multiplier + currentEMA;
    results[i] = Number(currentEMA.toFixed(4));
  }

  return results;
}

export function getLatestEMA(values, period) {
  const emaSeries = calculateEMA(values, period);
  return emaSeries.length > 0 ? emaSeries[emaSeries.length - 1] : null;
}
