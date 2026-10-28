import { IBrokerAdapter } from '../interface.js';
import { env } from '../../config/env.js';
import { getActiveToken } from './auth.js';
import { mapInternalToFyersOrderType, mapInternalToFyersSide, mapFyersOrderStatus } from './mapper.js';

export class FyersAdapter extends IBrokerAdapter {
  constructor({ appId = env.FYERS_APP_ID } = {}) {
    super();
    this.appId = appId;
    this.baseUrl = 'https://api-t1.fyers.in/api/v3';
    this.quotesCache = new Map();
    this.candlesCache = new Map();
  }

  getAuthHeader() {
    const token = getActiveToken();
    if (!token) {
      throw new Error('FYERS Broker Session inactive: Access Token is missing or expired. Authenticate first.');
    }
    return `${this.appId}:${token}`;
  }

  async _request(endpoint, { method = 'GET', body = null } = {}) {
    // FYERS Data API (/data/quotes, /data/history) lives under https://api-t1.fyers.in without /api/v3
    const base = endpoint.startsWith('/data/') ? 'https://api-t1.fyers.in' : this.baseUrl;
    const url = `${base}${endpoint}`;
    const headers = {
      Authorization: this.getAuthHeader(),
      'Content-Type': 'application/json',
    };

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (data.s !== 'ok' && data.code !== 200) {
      const errorMsg = data.message || `FYERS API Error (code: ${data.code})`;
      const error = new Error(errorMsg);
      error.fyersCode = data.code;
      error.details = data;
      throw error;
    }

    return data;
  }

  async getProfile() {
    return this._request('/profile');
  }

  async getFunds() {
    const res = await this._request('/funds');
    // FYERS funds response format: fund_limit array
    // Map to normalized structure
    const equityFund = res.fund_limit?.find((f) => f.title === 'Total Balance' || f.title === 'Available Balance') || {};
    return {
      availableBalance: equityFund.equityAmount || 0,
      totalBalance: equityFund.totalAmount || 0,
      raw: res,
    };
  }

  async getHoldings() {
    return this._request('/holdings');
  }

  async getPositions() {
    return this._request('/positions');
  }

  async getOrders() {
    const res = await this._request('/orders');
    return res.orderBook || [];
  }

  async getOrderStatus(brokerOrderId) {
    const orders = await this.getOrders();
    const found = orders.find((o) => o.id === brokerOrderId);
    if (!found) {
      return { status: 'UNKNOWN', brokerOrderId };
    }
    return {
      status: mapFyersOrderStatus(found.status, found.qty, found.filledQty),
      brokerOrderId: found.id,
      filledQty: found.filledQty,
      avgPrice: found.tradedPrice || 0,
      raw: found,
    };
  }

  async getQuotes(symbols = []) {
    if (!symbols || symbols.length === 0) return [];
    
    const now = Date.now();
    const cacheKey = symbols.slice().sort().join(',');
    const cached = this.quotesCache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    const joined = symbols.join(',');
    try {
      const res = await this._request(`/data/quotes?symbols=${encodeURIComponent(joined)}`);
      const data = res.d || [];
      if (Array.isArray(data) && data.length > 0) {
        this.quotesCache.set(cacheKey, { data, expiry: now + 2000 }); // cache 2s to respect 50 req/min
        return data;
      }
    } catch (err) {
      if (cached) return cached.data; // Serve last real FYERS data if rate limit occurs
      throw err;
    }
    return cached?.data || [];
  }

  async getHistoricalData({ symbol, resolution = '5', fromDate, toDate }) {
    const now = Date.now();
    const cacheKey = `${symbol}_${resolution}_${fromDate}_${toDate}`;
    const cached = this.candlesCache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    const params = new URLSearchParams({
      symbol,
      resolution,
      date_format: '1',
      range_from: fromDate,
      range_to: toDate,
      cont_flag: '1',
    });

    try {
      const res = await this._request(`/data/history?${params.toString()}`);
      if (!res.candles) return cached?.data || [];
      const data = res.candles.map(([ts, open, high, low, close, volume]) => ({
        timestamp: new Date(ts * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume,
        symbol,
      }));
      this.candlesCache.set(cacheKey, { data, expiry: now + 60000 }); // cache candles 60s
      return data;
    } catch (err) {
      if (cached) return cached.data; // Serve cached real candles if rate limit occurs
      throw err;
    }
  }

  async placeOrder(order) {
    // Payload mapping for official FYERS API v3
    const payload = {
      symbol: order.symbol,
      qty: order.quantity,
      type: mapInternalToFyersOrderType(order.order_type),
      side: mapInternalToFyersSide(order.side),
      productType: order.product_type || 'INTRADAY',
      limitPrice: order.price || 0,
      stopPrice: order.trigger_price || 0,
      validity: 'DAY',
      disclosedQty: 0,
      offlineOrder: false,
      orderTag: order.internal_order_id ? order.internal_order_id.slice(0, 20) : 'tradepilot',
    };

    const res = await this._request('/orders/sync', {
      method: 'POST',
      body: payload,
    });

    return {
      success: true,
      brokerOrderId: res.id,
      message: res.message,
    };
  }

  async modifyOrder(brokerOrderId, modification) {
    const payload = {
      id: brokerOrderId,
      type: modification.order_type ? mapInternalToFyersOrderType(modification.order_type) : undefined,
      qty: modification.quantity,
      limitPrice: modification.price || 0,
      stopPrice: modification.trigger_price || 0,
    };
    return this._request('/orders/sync', {
      method: 'PUT',
      body: payload,
    });
  }

  async cancelOrder(brokerOrderId) {
    return this._request('/orders/sync', {
      method: 'DELETE',
      body: { id: brokerOrderId },
    });
  }
}
