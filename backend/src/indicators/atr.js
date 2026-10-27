/**
 * Average True Range (ATR)
 * Standard Period: 14
 * Used for volatility calculation, dynamic stop-loss, and position sizing.
 */

export function calculateATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length <= period || period <= 0) {
    return new Array(candles ? candles.length : 0).fill(null);
  }

  const results = new Array(candles.length).fill(null);
  const trueRanges = [];

  // 1. Calculate True Range (TR) for each candle
  // TR for candle 0 is simply High - Low
  trueRanges.push(candles[0].high - candles[0].low);

  for (let i = 1; i < candles.length; i++) {
    const high = Number(candles[i].high);
    const low = Number(candles[i].low);
    const prevClose = Number(candles[i - 1].close);

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // 2. Initial ATR is simple average of first 'period' TR values
  let sumTR = 0;
  for (let i = 0; i < period; i++) {
    sumTR += trueRanges[i];
  }
  let currentATR = sumTR / period;
  results[period - 1] = Number(currentATR.toFixed(2));

  // 3. Wilder's smoothing for subsequent candles
  for (let i = period; i < candles.length; i++) {
    currentATR = (currentATR * (period - 1) + trueRanges[i]) / period;
    results[i] = Number(currentATR.toFixed(2));
  }

  return results;
}

export function getLatestATR(candles, period = 14) {
  const atrSeries = calculateATR(candles, period);
  return atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : null;
}
