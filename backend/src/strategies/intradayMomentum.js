import { calculateEMA } from '../indicators/ema.js';
import { calculateRSI } from '../indicators/rsi.js';
import { calculateATR } from '../indicators/atr.js';
import { calculateRVOL } from '../indicators/volume.js';
import { calculateVWAP } from '../indicators/vwap.js';
import { calculateSupertrend } from '../indicators/supertrend.js';
import { calculateMACD } from '../indicators/macd.js';
import { buildExplainableSignal } from './scorer.js';

export const DEFAULT_INTRADAY_CONFIG = {
  emaFastPeriod: 20,
  emaSlowPeriod: 50,
  rsiPeriod: 14,
  rsiMin: 55,
  rsiMax: 70,
  rvolThreshold: 1.0,
  atrPeriod: 14,
  slAtrMultiplier: 1.5,
  targetAtrMultiplier: 3.0,
  minScore: 80,
};

/**
 * Strategy A: Enhanced Intraday Momentum & Institutional Trend Following
 * Evaluates completed candles for bullish alignment across EMA, RSI, RVOL, VWAP, and Supertrend.
 */
export function evaluateIntradayMomentum(candles, customConfig = {}) {
  const config = { ...DEFAULT_INTRADAY_CONFIG, ...customConfig };

  if (!candles || candles.length < config.emaSlowPeriod) {
    return {
      signal_type: 'NO_TRADE',
      rejection_reason: `Insufficient historical candles (requires minimum ${config.emaSlowPeriod} bars, received ${candles ? candles.length : 0})`,
      signal_score: 0,
      conditions_failed: [{ name: 'Data Check', reason: 'Warmup period incomplete' }],
    };
  }

  // Extract series
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  const emaFastSeries = calculateEMA(closes, config.emaFastPeriod);
  const emaSlowSeries = calculateEMA(closes, config.emaSlowPeriod);
  const rsiSeries = calculateRSI(closes, config.rsiPeriod);
  const atrSeries = calculateATR(candles, config.atrPeriod);
  const rvolSeries = calculateRVOL(volumes, 20);
  const vwapSeries = calculateVWAP(candles);
  const supertrendSeries = calculateSupertrend(candles, 10, 3.0);
  const macdSeries = calculateMACD(closes, 12, 26, 9);

  const lastIdx = candles.length - 1;
  const latestCandle = candles[lastIdx];
  const price = latestCandle.close;
  const emaFast = emaFastSeries[lastIdx];
  const emaSlow = emaSlowSeries[lastIdx];
  const rsi = rsiSeries[lastIdx];
  const atr = atrSeries[lastIdx];
  const rvol = rvolSeries[lastIdx];
  const vwap = vwapSeries[lastIdx];
  const supertrend = supertrendSeries[lastIdx];
  const macd = macdSeries[lastIdx];

  const indicators = {
    price,
    emaFast,
    emaSlow,
    rsi,
    atr,
    rvol,
    vwap,
    supertrend: supertrend?.supertrend || null,
    supertrendTrend: supertrend?.trend || 'NEUTRAL',
    macd: macd?.macd || null,
    macdHistogram: macd?.histogram || null,
  };

  const rules = [
    {
      name: 'Price Above EMA Fast',
      description: `Close (${price}) > EMA ${config.emaFastPeriod} (${emaFast})`,
      weight: 20,
      condition: emaFast !== null && price > emaFast,
      failReason: `Price (${price}) is below EMA ${config.emaFastPeriod} (${emaFast})`,
    },
    {
      name: 'EMA Fast Above EMA Slow',
      description: `EMA ${config.emaFastPeriod} (${emaFast}) > EMA ${config.emaSlowPeriod} (${emaSlow})`,
      weight: 20,
      condition: emaFast !== null && emaSlow !== null && emaFast > emaSlow,
      failReason: `EMA ${config.emaFastPeriod} (${emaFast}) is not above EMA ${config.emaSlowPeriod} (${emaSlow})`,
    },
    {
      name: 'RSI Momentum Range',
      description: `RSI (${rsi}) between ${config.rsiMin} and ${config.rsiMax}`,
      weight: 20,
      condition: rsi !== null && rsi >= config.rsiMin && rsi <= config.rsiMax,
      failReason: rsi === null ? 'RSI calculating' : rsi < config.rsiMin ? `RSI (${rsi}) is below momentum threshold ${config.rsiMin}` : `RSI (${rsi}) is overbought (> ${config.rsiMax})`,
    },
    {
      name: 'Relative Volume Surge',
      description: `RVOL (${rvol}) >= ${config.rvolThreshold}`,
      weight: 15,
      condition: rvol !== null && rvol >= config.rvolThreshold,
      failReason: `Volume (${latestCandle.volume}) below recent average (RVOL: ${rvol})`,
    },
    {
      name: 'Institutional VWAP Support',
      description: `Close (${price}) >= VWAP (${vwap})`,
      weight: 15,
      condition: vwap !== null && price >= vwap,
      failReason: `Price (${price}) is trading below intraday VWAP (${vwap})`,
    },
    {
      name: 'Supertrend Bullish Alignment',
      description: `Supertrend is Bullish`,
      weight: 10,
      condition: !supertrend || supertrend.trend === 'BULLISH',
      failReason: `Supertrend is in Bearish sell regime (${supertrend?.supertrend})`,
    },
  ];

  return buildExplainableSignal({
    symbol: latestCandle.symbol || 'NSE:EQUITY',
    strategy: 'INTRADAY_MOMENTUM',
    candle: latestCandle,
    indicators,
    rules,
    parameters: {
      slMultiplier: config.slAtrMultiplier,
      targetMultiplier: config.targetAtrMultiplier,
      minScore: config.minScore,
    },
  });
}
