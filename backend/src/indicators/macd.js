import { calculateEMA } from './ema.js';

/**
 * Moving Average Convergence Divergence (MACD)
 * Standard: Fast = 12, Slow = 26, Signal = 9
 */

export function calculateMACD(closes = [], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!Array.isArray(closes) || closes.length < slowPeriod) {
    return new Array(closes ? closes.length : 0).fill(null);
  }

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  // Compute MACD Line
  const macdLine = new Array(closes.length).fill(null);
  for (let i = slowPeriod - 1; i < closes.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine[i] = Number((fastEMA[i] - slowEMA[i]).toFixed(4));
    }
  }

  // Filter valid MACD values to compute Signal Line
  const validMacdValues = macdLine.filter((v) => v !== null);
  const signalEMA = calculateEMA(validMacdValues, signalPeriod);

  const results = new Array(closes.length).fill(null);
  let signalIdx = 0;

  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null) {
      const sig = signalEMA[signalIdx];
      const macd = macdLine[i];
      const hist = sig !== null ? Number((macd - sig).toFixed(4)) : null;

      results[i] = {
        macd,
        signal: sig,
        histogram: hist,
      };
      signalIdx++;
    }
  }

  return results;
}

export function getLatestMACD(closes = [], fast = 12, slow = 26, signal = 9) {
  const series = calculateMACD(closes, fast, slow, signal);
  return series.length > 0 ? series[series.length - 1] : null;
}
