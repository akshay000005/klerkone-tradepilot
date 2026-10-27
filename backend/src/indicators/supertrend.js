import { calculateATR } from './atr.js';

/**
 * Supertrend Indicator
 * Standard Parameters: Period = 10, Multiplier = 3.0
 * Used extensively across Indian equity intraday desks for trailing stops & trend detection.
 */

export function calculateSupertrend(candles = [], period = 10, multiplier = 3.0) {
  if (!Array.isArray(candles) || candles.length <= period) {
    return new Array(candles ? candles.length : 0).fill(null);
  }

  const atrSeries = calculateATR(candles, period);
  const results = new Array(candles.length).fill(null);

  let prevUpperBand = 0;
  let prevLowerBand = 0;
  let prevSupertrend = 0;
  let prevTrend = 1; // 1 = Bullish (Green), -1 = Bearish (Red)

  for (let i = period; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const atr = atrSeries[i] || (c.close * 0.01);
    const hl2 = (Number(c.high) + Number(c.low)) / 2;

    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;

    // Final Upper Band
    let upperBand = basicUpper;
    if (i > period) {
      upperBand = (basicUpper < prevUpperBand || prevC.close > prevUpperBand)
        ? basicUpper
        : prevUpperBand;
    }

    // Final Lower Band
    let lowerBand = basicLower;
    if (i > period) {
      lowerBand = (basicLower > prevLowerBand || prevC.close < prevLowerBand)
        ? basicLower
        : prevLowerBand;
    }

    // Trend Direction & Supertrend Value
    let trend = prevTrend;
    let supertrend = 0;

    if (prevSupertrend === prevUpperBand) {
      trend = c.close > upperBand ? 1 : -1;
    } else {
      trend = c.close < lowerBand ? -1 : 1;
    }

    supertrend = trend === 1 ? lowerBand : upperBand;

    results[i] = {
      supertrend: Number(supertrend.toFixed(2)),
      trend: trend === 1 ? 'BULLISH' : 'BEARISH',
      upperBand: Number(upperBand.toFixed(2)),
      lowerBand: Number(lowerBand.toFixed(2)),
    };

    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
    prevSupertrend = supertrend;
    prevTrend = trend;
  }

  return results;
}

export function getLatestSupertrend(candles = [], period = 10, multiplier = 3.0) {
  const series = calculateSupertrend(candles, period, multiplier);
  return series.length > 0 ? series[series.length - 1] : null;
}
