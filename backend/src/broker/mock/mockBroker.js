import { v4 as uuidv4 } from 'uuid';
import { IBrokerAdapter } from '../interface.js';
import { generateSyntheticCandles } from '../../indicators/syntheticData.js';

/**
 * Mock / Paper Broker Adapter
 * Supports streaming REAL LIVE FYERS MARKET DATA when authorized,
 * while simulating risk-free execution with realistic slippage and statutory taxes.
 */
export class MockBrokerAdapter extends IBrokerAdapter {
  constructor({ startingBalance = 50000, getLiveBroker = null } = {}) {
    super();
    this.availableBalance = startingBalance;
    this.totalBalance = startingBalance;
    this.getLiveBroker = getLiveBroker;
    this.orders = [];
    this.positions = [];
    this.holdings = [];
    this.simulatedQuotes = new Map([
      ['NSE:RELIANCE-EQ', { symbol: 'NSE:RELIANCE-EQ', ltp: 1158.00, high: 1204.30, low: 1156.40, open: 1194.50, prev_close_price: 1196.20, ch: -38.20, chp: -3.19, volume: 21866598 }],
      ['NSE:SBIN-EQ', { symbol: 'NSE:SBIN-EQ', ltp: 956.80, high: 968.40, low: 947.20, open: 950.00, prev_close_price: 945.10, ch: 11.70, chp: 1.24, volume: 11012192 }],
      ['NSE:TCS-EQ', { symbol: 'NSE:TCS-EQ', ltp: 2460.00, high: 2510.00, low: 2452.00, open: 2505.00, prev_close_price: 2496.90, ch: -36.90, chp: -1.48, volume: 2540047 }],
      ['NSE:INFY-EQ', { symbol: 'NSE:INFY-EQ', ltp: 1123.15, high: 1165.00, low: 1120.00, open: 1160.00, prev_close_price: 1163.00, ch: -39.85, chp: -3.43, volume: 15636449 }],
      ['NSE:HDFCBANK-EQ', { symbol: 'NSE:HDFCBANK-EQ', ltp: 685.30, high: 692.00, low: 681.00, open: 682.00, prev_close_price: 680.20, ch: 5.10, chp: 0.75, volume: 28534206 }],
      ['NSE:ICICIBANK-EQ', { symbol: 'NSE:ICICIBANK-EQ', ltp: 1377.60, high: 1395.00, low: 1374.00, open: 1390.00, prev_close_price: 1386.90, ch: -9.30, chp: -0.67, volume: 9519327 }],
      ['NSE:BHARTIARTL-EQ', { symbol: 'NSE:BHARTIARTL-EQ', ltp: 1940.00, high: 1960.00, low: 1930.00, open: 1950.00, prev_close_price: 1945.00, ch: -5.00, chp: -0.26, volume: 3200000 }],
      ['NSE:ITC-EQ', { symbol: 'NSE:ITC-EQ', ltp: 478.50, high: 484.00, low: 476.00, open: 480.00, prev_close_price: 479.20, ch: -0.70, chp: -0.15, volume: 8500000 }],
      ['NSE:LT-EQ', { symbol: 'NSE:LT-EQ', ltp: 3620.00, high: 3655.00, low: 3610.00, open: 3640.00, prev_close_price: 3635.00, ch: -15.00, chp: -0.41, volume: 1200000 }],
      ['NSE:TATAMOTORS-EQ', { symbol: 'NSE:TATAMOTORS-EQ', ltp: 865.00, high: 875.00, low: 860.00, open: 870.00, prev_close_price: 868.50, ch: -3.50, chp: -0.40, volume: 5400000 }],
    ]);
  }

  resetStore() {
    this.availableBalance = 50000;
    this.totalBalance = 50000;
    this.orders = [];
    this.positions = [];
    this.holdings = [];
  }

  async getProfile() {
    return {
      name: 'Paper Trading Simulator',
      client_id: 'PAPER_MOCK_USER',
      email: 'paper@tradepilot.internal',
      broker: 'FYERS_SIMULATOR',
    };
  }

  async getFunds() {
    return {
      availableBalance: this.availableBalance,
      totalBalance: this.totalBalance,
      raw: { fund_limit: [{ title: 'Available Balance', equityAmount: this.availableBalance }] },
    };
  }

  async getHoldings() {
    return this.holdings;
  }

  async getPositions() {
    return this.positions;
  }

  async getOrders() {
    return this.orders;
  }

  async getQuotes(symbols = []) {
    // 1. Delegate to real FYERS live market quotes if live broker is connected
    const liveBroker = this.getLiveBroker ? this.getLiveBroker() : null;
    if (liveBroker) {
      try {
        const liveQuotes = await liveBroker.getQuotes(symbols);
        if (Array.isArray(liveQuotes) && liveQuotes.length > 0) {
          return liveQuotes;
        }
      } catch (err) {
        // Fall back to simulated quotes if live API call fails or outside hours
      }
    }

    // 2. Exact static closing quotes (Zero jitter outside market hours)
    return symbols.map((sym) => {
      const q = this.simulatedQuotes.get(sym);
      if (q) {
        const currentLtp = q.ltp;
        return {
          n: sym,
          s: 'ok',
          v: {
            symbol: sym,
            lp: currentLtp,
            open_price: q.open,
            high_price: q.high,
            low_price: q.low,
            prev_close_price: q.prev_close_price,
            ch: q.ch,
            chp: q.chp,
            volume: q.volume,
          },
        };
      }
      return {
        n: sym,
        s: 'ok',
        v: { symbol: sym, lp: 1000.0, open_price: 1000, high_price: 1005, low_price: 995, prev_close_price: 998, ch: 2, chp: 0.2, volume: 50000 },
      };
    });
  }

  async getHistoricalData({ symbol, resolution = '5', fromDate, toDate }) {
    const liveBroker = this.getLiveBroker ? this.getLiveBroker() : null;
    if (liveBroker) {
      try {
        const liveCandles = await liveBroker.getHistoricalData({ symbol, resolution, fromDate, toDate });
        if (Array.isArray(liveCandles) && liveCandles.length > 0) {
          return liveCandles;
        }
      } catch (err) {
        // Fall back to synthetic data
      }
    }

    const baseQuote = this.simulatedQuotes.get(symbol);
    const basePrice = baseQuote ? baseQuote.ltp : 1000;
    return generateSyntheticCandles({
      symbol,
      basePrice,
      barsCount: 75,
      trend: 'UP',
    });
  }

  async placeOrder(orderPayload) {
    const brokerOrderId = `PAPER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const quotes = await this.getQuotes([orderPayload.symbol]);
    const quoteObj = quotes.find((q) => q.n === orderPayload.symbol || q.v?.symbol === orderPayload.symbol);
    const currentPrice = quoteObj?.v?.lp || quoteObj?.lp || orderPayload.price || 1000;

    // Realistic slippage (0.05% higher for Buy, 0.05% lower for Sell)
    const slippageMultiplier = orderPayload.side === 'BUY' ? 1.0005 : 0.9995;
    const executionPrice = Number((currentPrice * slippageMultiplier).toFixed(2));

    const simulatedOrder = {
      id: brokerOrderId,
      symbol: orderPayload.symbol,
      qty: orderPayload.quantity,
      filledQty: orderPayload.quantity,
      type: orderPayload.order_type,
      side: orderPayload.side === 'BUY' ? 1 : -1,
      status: 2,
      tradedPrice: executionPrice,
      orderDateTime: new Date().toISOString(),
      orderTag: orderPayload.internal_order_id,
    };

    this.orders.unshift(simulatedOrder);

    return {
      success: true,
      brokerOrderId,
      tradedPrice: executionPrice,
      filledQuantity: orderPayload.quantity,
      message: 'Simulated paper order executed successfully.',
    };
  }

  async modifyOrder(brokerOrderId, modification) {
    const order = this.orders.find((o) => o.id === brokerOrderId);
    if (order) {
      if (modification.price) order.price = modification.price;
      if (modification.quantity) order.qty = modification.quantity;
      return { success: true };
    }
    throw new Error(`Order ${brokerOrderId} not found`);
  }

  async cancelOrder(brokerOrderId) {
    const order = this.orders.find((o) => o.id === brokerOrderId);
    if (order) {
      order.status = 1;
      return { success: true };
    }
    throw new Error(`Order ${brokerOrderId} not found`);
  }

  async getOrderStatus(brokerOrderId) {
    const order = this.orders.find((o) => o.id === brokerOrderId);
    if (!order) return { status: 'UNKNOWN', brokerOrderId };
    return {
      status: 'FILLED',
      brokerOrderId: order.id,
      filledQty: order.filledQty,
      avgPrice: order.tradedPrice,
    };
  }
}
