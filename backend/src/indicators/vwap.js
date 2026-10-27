/**
 * Volume Weighted Average Price (VWAP)
 * Standard benchmark used by institutional and intraday equity traders in India.
 * Formula: VWAP = Cumulative(Typical Price * Volume) / Cumulative(Volume)
 * Typical Price = (High + Low + Close) / 3
 */

export function calculateVWAP(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return [];
  }

  const results = new Array(candles.length).fill(null);
  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (Number(c.high) + Number(c.low) + Number(c.close)) / 3;
    const volume = Number(c.volume) || 1;

    cumulativeTypicalVolume += typicalPrice * volume;
    cumulativeVolume += volume;

    if (cumulativeVolume > 0) {
      results[i] = Number((cumulativeTypicalVolume / cumulativeVolume).toFixed(2));
    }
  }

  return results;
}

export function getLatestVWAP(candles = []) {
  const series = calculateVWAP(candles);
  return series.length > 0 ? series[series.length - 1] : null;
}
