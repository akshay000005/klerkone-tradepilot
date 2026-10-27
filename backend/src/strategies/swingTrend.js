import { calculateEMA } from '../indicators/ema.js';
import { calculateRSI } from '../indicators/rsi.js';
import { calculateATR } from '../indicators/atr.js';
import { calculateRVOL } from '../indicators/volume.js';
import { buildExplainableSignal } from './scorer.js';

export const DEFAULT_SWING_CONFIG = {
  emaFastPeriod: 20,
  emaSlowPeriod: 50,
  rsiPeriod: 14,
  rsiMin: 50,
  atrPeriod: 14,
  slAtrMultiplier: 2.0,
  targetAtrMultiplier: 4.0,
  minScore: 80,
};

/**
 * Strategy B: Swing Trend Following
 * Evaluates daily candles for sustained multi-day directional trends.
 */
export function evaluateSwingTrend(dailyCandles, customConfig = {}) {
  const config = { ...DEFAULT_SWING_CONFIG, ...customConfig };

  if (!dailyCandles || dailyCandles.length < config.emaSlowPeriod) {
    return {
      signal_type: 'NO_TRADE',
      rejection_reason: `Insufficient daily candles (requires minimum ${config.emaSlowPeriod} days, received ${dailyCandles ? dailyCandles.length : 0})`,
      signal_score: 0,
      conditions_failed: [{ name: 'Data Check', reason: 'Warmup period incomplete' }],
    };
  }

  const closes = dailyCandles.map((c) => c.close);
  const volumes = dailyCandles.map((c) => c.volume);

  const emaFastSeries = calculateEMA(closes, config.emaFastPeriod);
  const emaSlowSeries = calculateEMA(closes, config.emaSlowPeriod);
  const rsiSeries = calculateRSI(closes, config.rsiPeriod);
  const atrSeries = calculateATR(dailyCandles, config.atrPeriod);
  const rvolSeries = calculateRVOL(volumes, 20);

  const lastIdx = dailyCandles.length - 1;
  const latestCandle = dailyCandles[lastIdx];
  const price = latestCandle.close;
  const emaFast = emaFastSeries[lastIdx];
  const emaSlow = emaSlowSeries[lastIdx];
  const rsi = rsiSeries[lastIdx];
  const atr = atrSeries[lastIdx];
  const rvol = rvolSeries[lastIdx];

  const indicators = {
    price,
    emaFast,
    emaSlow,
    rsi,
    atr,
    rvol,
  };

  const rules = [
    {
      name: 'Price Above Fast EMA',
      description: `Daily Close (${price}) > EMA ${config.emaFastPeriod} (${emaFast})`,
      weight: 30,
      condition: emaFast !== null && price > emaFast,
      failReason: `Price (${price}) is below Daily EMA ${config.emaFastPeriod} (${emaFast})`,
    },
    {
      name: 'EMA Bullish Stack',
      description: `EMA ${config.emaFastPeriod} (${emaFast}) > EMA ${config.emaSlowPeriod} (${emaSlow})`,
      weight: 30,
      condition: emaFast !== null && emaSlow !== null && emaFast > emaSlow,
      failReason: `Daily EMA ${config.emaFastPeriod} (${emaFast}) is not above EMA ${config.emaSlowPeriod} (${emaSlow})`,
    },
    {
      name: 'Bullish Momentum',
      description: `RSI (${rsi}) > ${config.rsiMin}`,
      weight: 20,
      condition: rsi !== null && rsi > config.rsiMin,
      failReason: `Daily RSI (${rsi}) does not show bullish momentum (<= ${config.rsiMin})`,
    },
    {
      name: 'Adequate Liquidity',
      description: `Daily Volume (${latestCandle.volume}) meets activity baseline`,
      weight: 20,
      condition: latestCandle.volume > 5000,
      failReason: `Insufficient trading liquidity (${latestCandle.volume} shares traded)`,
    },
  ];

  return buildExplainableSignal({
    symbol: latestCandle.symbol || 'NSE:EQUITY',
    strategy: 'SWING_TREND',
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
