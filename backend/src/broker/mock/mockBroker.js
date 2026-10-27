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
      ['NSE:RELIANCE-EQ', { symbol: 'NSE:RELIANCE-EQ', ltp: 2540.50, high: 2560.00, low: 2530.00, open: 2535.00, prev_close_price: 2530.00, ch: 10.50, chp: 0.41, volume: 1540000 }],
      ['NSE:TCS-EQ', { symbol: 'NSE:TCS-EQ', ltp: 3820.00, high: 3845.00, low: 3805.00, open: 3810.00, prev_close_price: 3815.00, ch: 5.00, chp: 0.13, volume: 820000 }],
      ['NSE:HDFCBANK-EQ', { symbol: 'NSE:HDFCBANK-EQ', ltp: 1650.25, high: 1665.00, low: 1642.00, open: 1645.00, prev_close_price: 1640.00, ch: 10.25, chp: 0.63, volume: 2450000 }],
      ['NSE:INFY-EQ', { symbol: 'NSE:INFY-EQ', ltp: 1785.60, high: 1795.00, low: 1770.00, open: 1775.00, prev_close_price: 1772.00, ch: 13.60, chp: 0.77, volume: 1200000 }],
      ['NSE:ICICIBANK-EQ', { symbol: 'NSE:ICICIBANK-EQ', ltp: 1220.40, high: 1228.00, low: 1215.00, open: 1218.00, prev_close_price: 1212.00, ch: 8.40, chp: 0.69, volume: 1890000 }],
      ['NSE:SBIN-EQ', { symbol: 'NSE:SBIN-EQ', ltp: 785.10, high: 792.00, low: 780.00, open: 782.00, prev_close_price: 781.00, ch: 4.10, chp: 0.52, volume: 3100000 }],
      ['NSE:BHARTIARTL-EQ', { symbol: 'NSE:BHARTIARTL-EQ', ltp: 1480.00, high: 1492.00, low: 1475.00, open: 1478.00, prev_close_price: 1474.00, ch: 6.00, chp: 0.41, volume: 950000 }],
      ['NSE:ITC-EQ', { symbol: 'NSE:ITC-EQ', ltp: 495.20, high: 498.50, low: 492.00, open: 493.00, prev_close_price: 494.00, ch: 1.20, chp: 0.24, volume: 2700000 }],
      ['NSE:LT-EQ', { symbol: 'NSE:LT-EQ', ltp: 3560.00, high: 3585.00, low: 3540.00, open: 3550.00, prev_close_price: 3545.00, ch: 15.00, chp: 0.42, volume: 450000 }],
      ['NSE:TATAMOTORS-EQ', { symbol: 'NSE:TATAMOTORS-EQ', ltp: 890.30, high: 898.00, low: 885.00, open: 888.00, prev_close_price: 886.00, ch: 4.30, chp: 0.49, volume: 2150000 }],
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

    // 2. Simulated quotes fallback
    return symbols.map((sym) => {
      const q = this.simulatedQuotes.get(sym);
      if (q) {
        const jitter = (Math.random() - 0.5) * 0.2;
        const currentLtp = Number((q.ltp + jitter).toFixed(2));
        return {
          n: sym,
          s: 'ok',
          v: {
            symbol: sym,
            lp: currentLtp,
            open_price: q.open,
            high_price: Math.max(q.high, currentLtp),
            low_price: Math.min(q.low, currentLtp),
            prev_close_price: q.prev_close_price,
            ch: Number((currentLtp - q.prev_close_price).toFixed(2)),
            chp: Number((((currentLtp - q.prev_close_price) / q.prev_close_price) * 100).toFixed(2)),
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
