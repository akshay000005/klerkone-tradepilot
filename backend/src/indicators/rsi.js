/**
 * Relative Strength Index (RSI) using Wilder's Smoothing Method
 * Standard Period: 14
 */

export function calculateRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length <= period || period <= 0) {
    return new Array(closes ? closes.length : 0).fill(null);
  }

  const results = new Array(closes.length).fill(null);

  // 1. Calculate price changes
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(Number(closes[i]) - Number(closes[i - 1]));
  }

  // 2. Initial average gain and average loss over the first 'period' bars
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) gainSum += change;
    else lossSum += Math.abs(change);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  // First RSI value at index 'period'
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  results[period] = avgLoss === 0 ? 100 : Number((100 - (100 / (1 + rs))).toFixed(2));

  // 3. Wilder's exponential smoothing for subsequent periods
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      results[i + 1] = 100;
    } else {
      rs = avgGain / avgLoss;
      results[i + 1] = Number((100 - (100 / (1 + rs))).toFixed(2));
    }
  }

  return results;
}

export function getLatestRSI(closes, period = 14) {
  const rsiSeries = calculateRSI(closes, period);
  return rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1] : null;
}
