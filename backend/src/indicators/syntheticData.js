/**
 * Synthetic Candle Generator for Algorithmic Strategy Testing & Unit Verification
 * 
 * IMPORTANT:
 * All generated data here is explicitly tagged with `isSynthetic: true` and `dataSource: 'SYNTHETIC_GENERATOR'`.
 * Synthetic data is strictly for automated testing and offline backtest verification.
 * It is NEVER used in LIVE trading mode.
 */

export function generateSyntheticCandles({
  symbol = 'NSE:RELIANCE-EQ',
  basePrice = 2500,
  barsCount = 100,
  trend = 'UP', // 'UP', 'DOWN', 'SIDEWAYS'
  volatility = 0.015,
  intervalMinutes = 5,
  startDate = new Date('2026-01-05T09:15:00+05:30'),
}) {
  const candles = [];
  let currentClose = basePrice;
  let currentTime = new Date(startDate.getTime());

  // Deterministic seed for reproducible testing
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < barsCount; i++) {
    const trendDrift = trend === 'UP' ? 0.0015 : trend === 'DOWN' ? -0.0015 : 0;
    const randomShock = (pseudoRandom() - 0.48) * volatility;
    const changePercent = trendDrift + randomShock;

    const open = Number(currentClose.toFixed(2));
    currentClose = Number((open * (1 + changePercent)).toFixed(2));

    const wickUp = Math.abs(open * volatility * pseudoRandom() * 0.5);
    const wickDown = Math.abs(open * volatility * pseudoRandom() * 0.5);

    const high = Number((Math.max(open, currentClose) + wickUp).toFixed(2));
    const low = Number((Math.min(open, currentClose) - wickDown).toFixed(2));
    const volume = Math.floor(10000 + pseudoRandom() * 25000);

    candles.push({
      timestamp: currentTime.toISOString(),
      open,
      high,
      low,
      close: currentClose,
      volume,
      symbol,
      isSynthetic: true,
      dataSource: 'SYNTHETIC_TEST_GENERATOR',
    });

    currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
  }

  return candles;
}
