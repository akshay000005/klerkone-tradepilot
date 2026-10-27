import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { repository } from '../src/db/repository.js';

describe('TradePilot Express API Endpoints', () => {
  beforeEach(() => {
    repository.resetForTesting();
  });

  it('GET /api/v1/health should return system status and redacted configuration', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.tradingMode).toBeDefined();
    expect(res.body.config).toBeDefined();
    expect(res.body.config.FYERS_SECRET_KEY).toBeUndefined(); // Redacted!
  });

  it('GET and PUT /api/v1/settings should fetch and update risk limits', async () => {
    const getRes = await request(app).get('/api/v1/settings');
    expect(getRes.status).toBe(200);
    expect(getRes.body.allocated_capital).toBeDefined();

    const putRes = await request(app)
      .put('/api/v1/settings')
      .send({ allocated_capital: 75000, risk_per_trade: 0.8 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.allocated_capital).toBe(75000);
    expect(putRes.body.risk_per_trade).toBe(0.8);
  });

  it('Watchlist endpoints should allow list, add, and remove operations', async () => {
    const listRes = await request(app).get('/api/v1/watchlist');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThan(0);

    // Add symbol
    const addRes = await request(app)
      .post('/api/v1/watchlist')
      .send({ symbol: 'NSE:WIPRO-EQ', exchange: 'NSE', strategy: 'INTRADAY_MOMENTUM' });
    expect(addRes.status).toBe(200);
    expect(addRes.body.symbol).toBe('NSE:WIPRO-EQ');

    // Remove symbol
    const delRes = await request(app).delete('/api/v1/watchlist/NSE%3AWIPRO-EQ');
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });

  it('GET /api/v1/scanner should return real-time technical indicators and scores', async () => {
    const res = await request(app).get('/api/v1/scanner');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);

    const firstItem = res.body.results[0];
    expect(firstItem.symbol).toBeDefined();
    expect(firstItem.ltp).toBeGreaterThan(0);
    expect(firstItem.signal).toBeDefined();
    expect(firstItem.signal.signal_score).toBeDefined();
  });

  it('Order execution and position lifecycle in PAPER mode', async () => {
    // 1. Submit BUY order
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .send({
        symbol: 'NSE:SBIN-EQ',
        side: 'BUY',
        quantity: 10,
        price: 785.00,
        tradingMode: 'PAPER',
        strategy: 'INTRADAY_MOMENTUM',
      });

    expect(orderRes.status).toBe(200);
    expect(orderRes.body.success).toBe(true);
    expect(orderRes.body.status).toBe('FILLED');

    // 2. Verify Position is held
    const posRes = await request(app).get('/api/v1/positions?mode=PAPER');
    expect(posRes.status).toBe(200);
    const pos = posRes.body.find((p) => p.symbol === 'NSE:SBIN-EQ');
    expect(pos).toBeDefined();
    expect(pos.quantity).toBe(10);

    // 3. Exit Position
    const exitRes = await request(app)
      .post('/api/v1/positions/exit')
      .send({
        symbol: 'NSE:SBIN-EQ',
        tradingMode: 'PAPER',
      });
    expect(exitRes.status).toBe(200);
    expect(exitRes.body.success).toBe(true);

    // 4. Verify Position is cleared
    const posAfter = await request(app).get('/api/v1/positions?mode=PAPER');
    const posGone = posAfter.body.find((p) => p.symbol === 'NSE:SBIN-EQ');
    expect(posGone).toBeUndefined();

    // 5. Verify Trade is logged in tradebook
    const tradeRes = await request(app).get('/api/v1/trades?mode=PAPER');
    expect(tradeRes.status).toBe(200);
    const recordedTrade = tradeRes.body.find((t) => t.symbol === 'NSE:SBIN-EQ');
    expect(recordedTrade).toBeDefined();
    expect(recordedTrade.realised_pnl).toBeDefined();
    expect(recordedTrade.estimated_charges).toBeGreaterThan(0);
  });

  it('Kill Switch activation and reset via API', async () => {
    const haltRes = await request(app)
      .post('/api/v1/risk/kill-switch')
      .send({ reason: 'API Test Halt', squareOffAllPositions: false, tradingMode: 'PAPER' });
    expect(haltRes.status).toBe(200);
    expect(haltRes.body.tradingHalted).toBe(true);

    // New order must be rejected while halted
    const rejectOrder = await request(app)
      .post('/api/v1/orders')
      .send({
        symbol: 'NSE:INFY-EQ',
        side: 'BUY',
        quantity: 5,
        price: 1750,
        tradingMode: 'PAPER',
      });
    expect(rejectOrder.status).toBe(400);
    expect(rejectOrder.body.status).toBe('REJECTED');

    // Reset kill switch
    const resetRes = await request(app)
      .post('/api/v1/risk/reset-kill-switch')
      .send({ tradingMode: 'PAPER' });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.tradingHalted).toBe(false);
  });

  it('Backtest run via API', async () => {
    const res = await request(app)
      .post('/api/v1/backtest/run')
      .send({
        symbol: 'NSE:RELIANCE-EQ',
        strategy: 'INTRADAY_MOMENTUM',
        initialCapital: 50000,
        riskPerTradePercent: 0.5,
      });

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('NSE:RELIANCE-EQ');
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.netPnL).toBeDefined();
    expect(res.body.metrics.equityCurve.length).toBeGreaterThan(0);
  });

  it('Optional AI news analyzer route', async () => {
    const res = await request(app)
      .post('/api/v1/ai/analyze-news')
      .send({
        headline: 'Reliance Industries posts quarterly net profit increase of 14 percent',
      });

    expect(res.status).toBe(200);
    expect(res.body.sentiment).toBe('BULLISH');
    expect(res.body.score).toBeGreaterThan(0);
  });
});
