import { runBacktest } from './engine.js';

/**
 * Parameter Sensitivity Analysis
 * Tests parameter variations to identify whether strategy profitability
 * is robust or brittle (curve-fitted to single parameter choices).
 */
export function runSensitivityAnalysis({
  symbol = 'NSE:RELIANCE-EQ',
  candles = [],
  strategy = 'INTRADAY_MOMENTUM',
  baseConfig = {},
  initialCapital = 50000,
}) {
  const emaVariations = [15, 20, 25];
  const rsiVariations = [50, 55, 60];
  const results = [];

  for (const emaFast of emaVariations) {
    for (const rsiMin of rsiVariations) {
      const testConfig = {
        ...baseConfig,
        emaFastPeriod: emaFast,
        rsiMin,
      };

      try {
        const backtestResult = runBacktest({
          symbol,
          candles,
          strategy,
          strategyConfig: testConfig,
          initialCapital,
        });

        results.push({
          parameters: { emaFastPeriod: emaFast, rsiMin },
          netPnL: backtestResult.metrics.netPnL,
          winRate: backtestResult.metrics.winRate,
          maxDrawdownPercent: backtestResult.metrics.maxDrawdownPercent,
          totalTrades: backtestResult.metrics.totalTrades,
          profitFactor: backtestResult.metrics.profitFactor,
        });
      } catch (err) {
        // Skip failed run
      }
    }
  }

  // Calculate stability score: variance of Net PnL across variations
  const pnlValues = results.map((r) => r.netPnL);
  const avgPnL = pnlValues.reduce((a, b) => a + b, 0) / (pnlValues.length || 1);
  const variance = pnlValues.reduce((sum, val) => sum + Math.pow(val - avgPnL, 2), 0) / (pnlValues.length || 1);
  const stdDev = Math.sqrt(variance);

  // Lower coefficient of variation = higher stability
  const coefficientOfVariation = avgPnL !== 0 ? Math.abs(stdDev / avgPnL) : 999;
  const isRobust = coefficientOfVariation < 1.0;

  return {
    symbol,
    strategy,
    testsCount: results.length,
    averagePnL: Number(avgPnL.toFixed(2)),
    stdDevPnL: Number(stdDev.toFixed(2)),
    isRobust,
    sensitivityScore: isRobust ? 'STABLE' : 'HIGH_VARIANCE_WARNING',
    grid: results,
  };
}
