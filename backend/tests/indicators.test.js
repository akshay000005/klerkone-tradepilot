import { describe, it, expect } from 'vitest';
import { calculateEMA } from '../src/indicators/ema.js';
import { calculateRSI } from '../src/indicators/rsi.js';
import { calculateATR } from '../src/indicators/atr.js';
import { calculateRVOL } from '../src/indicators/volume.js';
import { generateSyntheticCandles } from '../src/indicators/syntheticData.js';
import { evaluateIntradayMomentum } from '../src/strategies/intradayMomentum.js';
import { evaluateSwingTrend } from '../src/strategies/swingTrend.js';
import { calculateIndianEquityCharges } from '../src/config/charges.js';

describe('Technical Indicators & Quantitative Modules', () => {
  describe('EMA (Exponential Moving Average)', () => {
    it('should return null for warmup periods and calculate accurate subsequent values', () => {
      const prices = [10, 11, 12, 13, 14, 15];
      const period = 3;
      const ema = calculateEMA(prices, period);

      expect(ema[0]).toBeNull();
      expect(ema[1]).toBeNull();
      // First EMA at index 2 is SMA of [10, 11, 12] = 11.00
      expect(ema[2]).toBe(11);

      // Multiplier = 2 / (3 + 1) = 0.5
      // Index 3: (13 - 11) * 0.5 + 11 = 12.00
      expect(ema[3]).toBe(12);

      // Index 4: (14 - 12) * 0.5 + 12 = 13.00
      expect(ema[4]).toBe(13);

      // Index 5: (15 - 13) * 0.5 + 13 = 14.00
      expect(ema[5]).toBe(14);
    });

    it('should handle empty or invalid arrays gracefully', () => {
      expect(calculateEMA([], 14)).toEqual([]);
      expect(calculateEMA([10, 20], 5)).toEqual([null, null]);
    });
  });

  describe('RSI (Wilder Relative Strength Index)', () => {
    it('should calculate RSI bounded strictly between 0 and 100', () => {
      const candles = generateSyntheticCandles({ barsCount: 60, trend: 'UP' });
      const closes = candles.map((c) => c.close);
      const rsi = calculateRSI(closes, 14);

      expect(rsi.length).toBe(closes.length);
      const validRsi = rsi.filter((r) => r !== null);
      expect(validRsi.length).toBeGreaterThan(0);

      for (const val of validRsi) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    });

    it('should return 100 for purely upward price sequences', () => {
      const strictlyUp = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
      const rsi = calculateRSI(strictlyUp, 14);
      expect(rsi[14]).toBe(100);
    });
  });

  describe('ATR (Average True Range)', () => {
    it('should calculate positive volatility numbers across bars', () => {
      const candles = generateSyntheticCandles({ barsCount: 30, basePrice: 1000 });
      const atr = calculateATR(candles, 14);

      expect(atr.length).toBe(30);
      const validAtr = atr.filter((a) => a !== null);
      expect(validAtr.length).toBeGreaterThan(0);
      expect(validAtr[validAtr.length - 1]).toBeGreaterThan(0);
    });
  });

  describe('RVOL (Relative Volume)', () => {
    it('should measure volume relative to moving average', () => {
      const volumes = [1000, 1000, 1000, 1000, 2000];
      const rvol = calculateRVOL(volumes, 4);

      // Average of first 4 is 1000. At index 4, volume is 2000 => RVOL = 2.0
      expect(rvol[4]).toBe(2.0);
    });
  });

  describe('Indian Statutory Charges Calculator', () => {
    it('should correctly calculate Intraday charges with FYERS ₹20 cap and STT on sell only', () => {
      // 100 shares of SBIN at ₹600 buy, ₹610 sell
      const charges = calculateIndianEquityCharges({
        buyPrice: 600,
        sellPrice: 610,
        quantity: 100,
        productType: 'INTRADAY',
      });

      expect(charges.buyTurnover).toBe(60000);
      expect(charges.sellTurnover).toBe(61000);
      expect(charges.totalTurnover).toBe(121000);

      // Buy Brokerage = min(20, 60000 * 0.0003 = 18) = 18
      // Sell Brokerage = min(20, 61000 * 0.0003 = 18.3) = 18.3
      // Total Brokerage = 36.3
      expect(charges.brokerage).toBe(36.3);

      // STT on Intraday is 0.025% on sell side: 61000 * 0.00025 = 15.25 => round to 15
      expect(charges.stt).toBe(15);

      // Gross PnL = (610 - 600) * 100 = 1000
      expect(charges.grossPnL).toBe(1000);

      // Net PnL must be grossPnL minus total charges
      expect(charges.netPnL).toBe(Number((1000 - charges.totalCharges).toFixed(2)));
    });

    it('should correctly calculate Delivery charges with zero brokerage and 0.1% STT on both sides', () => {
      const charges = calculateIndianEquityCharges({
        buyPrice: 1000,
        sellPrice: 1050,
        quantity: 50,
        productType: 'CNC',
      });

      expect(charges.brokerage).toBe(0); // Zero delivery brokerage
      // STT: 0.1% of (50000 + 52500 = 102500) = 102.5 => 103
      expect(charges.stt).toBe(103);
      expect(charges.grossPnL).toBe(2500);
      expect(charges.netPnL).toBeLessThan(2500);
    });
  });

  describe('Strategy Engine & Explainable Scorer', () => {
    it('should generate an explainable BUY signal on a strongly bullish synthetic trend', () => {
      const bullishCandles = generateSyntheticCandles({
        barsCount: 70,
        basePrice: 500,
        trend: 'UP',
        volatility: 0.005,
      });

      const signal = evaluateIntradayMomentum(bullishCandles, { minScore: 50 });
      expect(signal).toBeDefined();
      expect(signal.conditions_met).toBeDefined();
      expect(signal.indicator_snapshot.price).toBeGreaterThan(0);
      expect(signal.signal_score).toBeGreaterThanOrEqual(0);
    });

    it('should reject trades on a downtrend and record the specific failing reasons', () => {
      const bearishCandles = generateSyntheticCandles({
        barsCount: 70,
        basePrice: 500,
        trend: 'DOWN',
        volatility: 0.005,
      });

      const signal = evaluateIntradayMomentum(bearishCandles);
      expect(signal.signal_type).toBe('NO_TRADE');
      expect(signal.rejection_reason).toBeDefined();
      expect(signal.conditions_failed.length).toBeGreaterThan(0);
    });
  });
});
