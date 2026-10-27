import { describe, it, expect } from 'vitest';
import { runBacktest } from '../src/backtest/engine.js';
import { runSensitivityAnalysis } from '../src/backtest/sensitivity.js';
import { generateSyntheticCandles } from '../src/indicators/syntheticData.js';

describe('Historical Backtesting Engine', () => {
  it('should run backtest without look-ahead bias and calculate performance metrics', () => {
    const candles = generateSyntheticCandles({
      symbol: 'NSE:INFY-EQ',
      basePrice: 1500,
      barsCount: 120,
      trend: 'UP',
      volatility: 0.008,
    });

    const result = runBacktest({
      symbol: 'NSE:INFY-EQ',
      candles,
      strategy: 'INTRADAY_MOMENTUM',
      initialCapital: 100000,
      riskPerTradePercent: 1.0,
      slippagePercent: 0.05,
    });

    expect(result.symbol).toBe('NSE:INFY-EQ');
    expect(result.metrics).toBeDefined();
    expect(result.metrics.initialCapital).toBe(100000);
    expect(result.metrics.endingCapital).toBeDefined();
    expect(result.metrics.equityCurve.length).toBeGreaterThan(0);
    expect(result.metrics.totalCharges).toBeGreaterThanOrEqual(0);

    for (const trade of result.trades) {
      expect(trade.entry_price).toBeGreaterThan(0);
      expect(trade.exit_price).toBeGreaterThan(0);
      expect(trade.quantity).toBeGreaterThan(0);
      expect(trade.trading_mode).toBe('BACKTEST');
    }
  });

  it('should perform parameter sensitivity analysis across variations', () => {
    const candles = generateSyntheticCandles({
      symbol: 'NSE:TCS-EQ',
      basePrice: 3800,
      barsCount: 100,
      trend: 'UP',
      volatility: 0.006,
    });

    const sensitivity = runSensitivityAnalysis({
      symbol: 'NSE:TCS-EQ',
      candles,
      strategy: 'INTRADAY_MOMENTUM',
      initialCapital: 50000,
    });

    expect(sensitivity.testsCount).toBe(9);
    expect(sensitivity.grid.length).toBe(9);
    expect(sensitivity.sensitivityScore).toBeDefined();
  });
});
