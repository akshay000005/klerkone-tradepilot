/**
 * Relative Volume (RVOL) and Volume Analysis
 * Evaluates whether current bar volume is abnormal compared to recent prior average.
 */

export function calculateVolumeSMA(volumes, period = 20) {
  if (!Array.isArray(volumes) || volumes.length < period || period <= 0) {
    return new Array(volumes ? volumes.length : 0).fill(null);
  }

  const results = new Array(volumes.length).fill(null);
  let currentSum = 0;

  for (let i = 0; i < period; i++) {
    currentSum += Number(volumes[i]);
  }
  results[period - 1] = Math.round(currentSum / period);

  for (let i = period; i < volumes.length; i++) {
    currentSum += Number(volumes[i]) - Number(volumes[i - period]);
    results[i] = Math.round(currentSum / period);
  }

  return results;
}

export function calculateRVOL(volumes, period = 20) {
  const smaSeries = calculateVolumeSMA(volumes, period);
  const rvolSeries = new Array(volumes.length).fill(null);

  for (let i = 0; i < volumes.length; i++) {
    // Standard RVOL compares current volume to the prior baseline average (excluding current bar)
    const priorAvg = i > 0 ? smaSeries[i - 1] : smaSeries[i];
    if (priorAvg && priorAvg > 0) {
      rvolSeries[i] = Number((Number(volumes[i]) / priorAvg).toFixed(2));
    }
  }

  return rvolSeries;
}

export function getLatestRVOL(volumes, period = 20) {
  const rvolSeries = calculateRVOL(volumes, period);
  return rvolSeries.length > 0 ? rvolSeries[rvolSeries.length - 1] : null;
}
