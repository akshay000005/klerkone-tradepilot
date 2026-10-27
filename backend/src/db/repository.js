import { v4 as uuidv4 } from 'uuid';
import { supabase } from './client.js';
import { env } from '../config/env.js';

// In-Memory Repository Store (Used when Supabase is not configured)
let memStore = createInitialMemStore();

function createInitialMemStore() {
  return {
    userSettings: {
      id: uuidv4(),
      trading_mode: env.DEFAULT_TRADING_MODE,
      selected_strategy: 'INTRADAY_MOMENTUM',
      allocated_capital: env.DEFAULT_ALLOCATED_CAPITAL,
      risk_per_trade: env.RISK_PER_TRADE_PERCENT,
      daily_loss_limit: env.DAILY_LOSS_LIMIT_PERCENT,
      maximum_open_positions: env.MAX_OPEN_POSITIONS,
      maximum_capital_utilisation: env.MAX_CAPITAL_UTILISATION_PERCENT,
      live_trading_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    brokerSession: {
      id: uuidv4(),
      broker_name: 'FYERS',
      session_status: env.FYERS_ACCESS_TOKEN ? 'CONNECTED' : 'DISCONNECTED',
      token_expiry: null,
      last_successful_connection: env.FYERS_ACCESS_TOKEN ? new Date().toISOString() : null,
      error_message: null,
      created_at: new Date().toISOString(),
    },
    watchlist: [
      { id: uuidv4(), symbol: 'NSE:RELIANCE-EQ', exchange: 'NSE', instrument_identifier: 'RELIANCE', enabled: true, strategy: 'INTRADAY_MOMENTUM', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:TCS-EQ', exchange: 'NSE', instrument_identifier: 'TCS', enabled: true, strategy: 'INTRADAY_MOMENTUM', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:HDFCBANK-EQ', exchange: 'NSE', instrument_identifier: 'HDFCBANK', enabled: true, strategy: 'INTRADAY_MOMENTUM', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:INFY-EQ', exchange: 'NSE', instrument_identifier: 'INFY', enabled: true, strategy: 'INTRADAY_MOMENTUM', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:ICICIBANK-EQ', exchange: 'NSE', instrument_identifier: 'ICICIBANK', enabled: true, strategy: 'INTRADAY_MOMENTUM', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:SBIN-EQ', exchange: 'NSE', instrument_identifier: 'SBIN', enabled: true, strategy: 'INTRADAY_MOMENTUM', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:BHARTIARTL-EQ', exchange: 'NSE', instrument_identifier: 'BHARTIARTL', enabled: true, strategy: 'INTRADAY_MOMENTUM', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:ITC-EQ', exchange: 'NSE', instrument_identifier: 'ITC', enabled: true, strategy: 'INTRADAY_MOMENTUM', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:LT-EQ', exchange: 'NSE', instrument_identifier: 'LT', enabled: true, strategy: 'SWING_TREND', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
      { id: uuidv4(), symbol: 'NSE:TATAMOTORS-EQ', exchange: 'NSE', instrument_identifier: 'TATAMOTORS', enabled: true, strategy: 'SWING_TREND', lot_size: 1, tick_size: 0.05, created_at: new Date().toISOString() },
    ],
    signals: [],
    orders: [],
    positions: [],
    trades: [],
    dailyRisk: {},
    auditLogs: [],
  };
}

export const repository = {
  resetForTesting() {
    memStore = createInitialMemStore();
  },

  async resetPaperTrading() {
    memStore.orders = memStore.orders.filter((o) => o.trading_mode !== 'PAPER');
    memStore.positions = memStore.positions.filter((p) => p.trading_mode !== 'PAPER');
    memStore.trades = memStore.trades.filter((t) => t.trading_mode !== 'PAPER');

    const today = new Date().toISOString().split('T')[0];
    const key = `${today}:PAPER`;
    delete memStore.dailyRisk[key];

    if (supabase) {
      await supabase.from('orders').delete().eq('trading_mode', 'PAPER');
      await supabase.from('positions').delete().eq('trading_mode', 'PAPER');
      await supabase.from('trades').delete().eq('trading_mode', 'PAPER');
      await supabase.from('daily_risk_state').delete().eq('trading_mode', 'PAPER').eq('date', today);
    }

    await this.recordAuditLog({
      eventType: 'PAPER_SESSION_RESET',
      relevantEntityId: 'PAPER',
      metadata: { date: today },
      outcome: 'INFO',
    });

    return { success: true, message: 'Paper trading session and circuit breaker reset successfully.' };
  },

  isSupabaseConnected() {
    return Boolean(supabase);
  },

  // ----------------------------------------------------------------------------
  // 1. USER SETTINGS
  // ----------------------------------------------------------------------------
  async getUserSettings() {
    if (supabase) {
      const { data, error } = await supabase.from('user_settings').select('*').limit(1).single();
      if (!error && data) return data;
    }
    return { ...memStore.userSettings };
  },

  async updateUserSettings(partial) {
    const updated = {
      ...memStore.userSettings,
      ...partial,
      updated_at: new Date().toISOString(),
    };
    memStore.userSettings = updated;

    if (supabase) {
      await supabase.from('user_settings').upsert(updated);
    }
    await this.recordAuditLog({
      eventType: 'SETTINGS_UPDATE',
      relevantEntityId: updated.id,
      metadata: partial,
      outcome: 'SUCCESS',
    });
    return updated;
  },

  // ----------------------------------------------------------------------------
  // 2. WATCHLIST
  // ----------------------------------------------------------------------------
  async getWatchlist() {
    if (supabase) {
      const { data, error } = await supabase.from('watchlist').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) return data;
    }
    return [...memStore.watchlist];
  },

  async addWatchlistSymbol(symbolData) {
    const record = {
      id: uuidv4(),
      symbol: symbolData.symbol.toUpperCase(),
      exchange: symbolData.exchange || 'NSE',
      instrument_identifier: symbolData.instrument_identifier || symbolData.symbol.replace('NSE:', '').replace('-EQ', ''),
      enabled: symbolData.enabled !== undefined ? symbolData.enabled : true,
      strategy: symbolData.strategy || 'INTRADAY_MOMENTUM',
      lot_size: symbolData.lot_size || 1,
      tick_size: symbolData.tick_size || 0.05,
      created_at: new Date().toISOString(),
    };
    memStore.watchlist.push(record);
    if (supabase) {
      await supabase.from('watchlist').insert(record);
    }
    return record;
  },

  async removeWatchlistSymbol(symbol) {
    memStore.watchlist = memStore.watchlist.filter((item) => item.symbol !== symbol);
    if (supabase) {
      await supabase.from('watchlist').delete().eq('symbol', symbol);
    }
    return true;
  },

  async toggleWatchlistSymbol(symbol, enabled) {
    const target = memStore.watchlist.find((item) => item.symbol === symbol);
    if (target) {
      target.enabled = enabled;
    }
    if (supabase) {
      await supabase.from('watchlist').update({ enabled }).eq('symbol', symbol);
    }
    return target;
  },

  // ----------------------------------------------------------------------------
  // 3. SIGNALS
  // ----------------------------------------------------------------------------
  async recordSignal(signal) {
    const record = {
      id: signal.id || uuidv4(),
      symbol: signal.symbol,
      strategy: signal.strategy,
      signal_type: signal.signal_type,
      candle_timestamp: signal.candle_timestamp || new Date().toISOString(),
      indicator_snapshot: signal.indicator_snapshot || {},
      entry_price: signal.entry_price || null,
      stop_loss: signal.stop_loss || null,
      target_price: signal.target_price || null,
      risk_amount: signal.risk_amount || null,
      suggested_quantity: signal.suggested_quantity || 0,
      signal_score: signal.signal_score || 0,
      rejection_reason: signal.rejection_reason || null,
      conditions_met: signal.conditions_met || [],
      conditions_failed: signal.conditions_failed || [],
      created_at: new Date().toISOString(),
    };
    memStore.signals.unshift(record);
    if (memStore.signals.length > 500) memStore.signals.pop();

    if (supabase) {
      await supabase.from('signals').insert(record);
    }
    return record;
  },

  async getSignals(limit = 50) {
    if (supabase) {
      const { data, error } = await supabase
        .from('signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && data) return data;
    }
    return memStore.signals.slice(0, limit);
  },

  // ----------------------------------------------------------------------------
  // 4. ORDERS
  // ----------------------------------------------------------------------------
  async createOrder(order) {
    const record = {
      id: uuidv4(),
      broker_order_id: order.broker_order_id || null,
      internal_order_id: order.internal_order_id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      filled_quantity: order.filled_quantity || 0,
      price: order.price || 0,
      trigger_price: order.trigger_price || 0,
      average_fill_price: order.average_fill_price || 0,
      order_type: order.order_type || 'MARKET',
      product_type: order.product_type || 'INTRADAY',
      order_status: order.order_status || 'CREATED',
      trading_mode: order.trading_mode || 'PAPER',
      error_message: order.error_message || null,
      submitted_at: order.submitted_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memStore.orders.unshift(record);
    if (supabase) {
      await supabase.from('orders').insert(record);
    }
    return record;
  },

  async updateOrder(internalOrderId, updates) {
    const order = memStore.orders.find((o) => o.internal_order_id === internalOrderId);
    if (order) {
      Object.assign(order, updates, { updated_at: new Date().toISOString() });
    }
    if (supabase) {
      await supabase
        .from('orders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('internal_order_id', internalOrderId);
    }
    return order;
  },

  async getOrders(mode = null, limit = 100) {
    let result = memStore.orders;
    if (mode) {
      result = result.filter((o) => o.trading_mode === mode);
    }
    if (supabase) {
      let query = supabase.from('orders').select('*').order('submitted_at', { ascending: false }).limit(limit);
      if (mode) query = query.eq('trading_mode', mode);
      const { data, error } = await query;
      if (!error && data) return data;
    }
    return result.slice(0, limit);
  },

  async getOrderByInternalId(internalOrderId) {
    const order = memStore.orders.find((o) => o.internal_order_id === internalOrderId);
    if (order) return order;
    if (supabase) {
      const { data, error } = await supabase.from('orders').select('*').eq('internal_order_id', internalOrderId).single();
      if (!error && data) return data;
    }
    return null;
  },

  // ----------------------------------------------------------------------------
  // 5. POSITIONS
  // ----------------------------------------------------------------------------
  async getPositions(mode = null) {
    let result = memStore.positions;
    if (mode) {
      result = result.filter((p) => p.trading_mode === mode);
    }
    if (supabase) {
      let query = supabase.from('positions').select('*');
      if (mode) query = query.eq('trading_mode', mode);
      const { data, error } = await query;
      if (!error && data) return data;
    }
    return result;
  },

  async getPosition(symbol, mode) {
    const pos = memStore.positions.find((p) => p.symbol === symbol && p.trading_mode === mode);
    if (pos) return pos;
    if (supabase) {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('symbol', symbol)
        .eq('trading_mode', mode)
        .single();
      if (!error && data) return data;
    }
    return null;
  },

  async upsertPosition(pos) {
    const existingIndex = memStore.positions.findIndex(
      (p) => p.symbol === pos.symbol && p.trading_mode === pos.trading_mode
    );
    const updated = {
      id: existingIndex >= 0 ? memStore.positions[existingIndex].id : uuidv4(),
      symbol: pos.symbol,
      strategy: pos.strategy,
      quantity: pos.quantity,
      average_entry_price: pos.average_entry_price,
      current_market_price: pos.current_market_price || pos.average_entry_price,
      current_stop_loss: pos.current_stop_loss,
      current_target: pos.current_target,
      unrealised_pnl: pos.unrealised_pnl || 0,
      trading_mode: pos.trading_mode,
      product_type: pos.product_type || 'INTRADAY',
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      memStore.positions[existingIndex] = updated;
    } else {
      memStore.positions.push(updated);
    }

    if (supabase) {
      await supabase.from('positions').upsert(updated, { onConflict: 'symbol,trading_mode' });
    }
    return updated;
  },

  async removePosition(symbol, mode) {
    memStore.positions = memStore.positions.filter(
      (p) => !(p.symbol === symbol && p.trading_mode === mode)
    );
    if (supabase) {
      await supabase.from('positions').delete().eq('symbol', symbol).eq('trading_mode', mode);
    }
    return true;
  },

  // ----------------------------------------------------------------------------
  // 6. TRADES (CLOSED ROUND-TRIPS)
  // ----------------------------------------------------------------------------
  async recordTrade(trade) {
    const record = {
      id: uuidv4(),
      symbol: trade.symbol,
      strategy: trade.strategy,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      quantity: trade.quantity,
      realised_pnl: trade.realised_pnl,
      estimated_charges: trade.estimated_charges || 0,
      actual_charges: trade.actual_charges || trade.estimated_charges || 0,
      entry_timestamp: trade.entry_timestamp || new Date().toISOString(),
      exit_timestamp: trade.exit_timestamp || new Date().toISOString(),
      trading_mode: trade.trading_mode,
      exit_reason: trade.exit_reason || 'TARGET/SL',
      created_at: new Date().toISOString(),
    };
    memStore.trades.unshift(record);
    if (supabase) {
      await supabase.from('trades').insert(record);
    }
    return record;
  },

  async getTrades(mode = null, limit = 100) {
    let result = memStore.trades;
    if (mode) {
      result = result.filter((t) => t.trading_mode === mode);
    }
    if (supabase) {
      let query = supabase.from('trades').select('*').order('exit_timestamp', { ascending: false }).limit(limit);
      if (mode) query = query.eq('trading_mode', mode);
      const { data, error } = await query;
      if (!error && data) return data;
    }
    return result.slice(0, limit);
  },

  // ----------------------------------------------------------------------------
  // 7. DAILY RISK STATE
  // ----------------------------------------------------------------------------
  async getDailyRiskState(dateString, mode = 'PAPER') {
    const key = `${dateString}_${mode}`;
    if (!memStore.dailyRisk[key]) {
      const settings = await this.getUserSettings();
      const startingCapital = settings.allocated_capital;
      const dailyLossLimit = Number(((startingCapital * settings.daily_loss_limit) / 100).toFixed(2));
      memStore.dailyRisk[key] = {
        id: uuidv4(),
        trading_date: dateString,
        trading_mode: mode,
        starting_capital: startingCapital,
        realised_pnl: 0,
        unrealised_pnl: 0,
        daily_loss_limit: dailyLossLimit,
        trading_halted: false,
        halt_reason: null,
        updated_at: new Date().toISOString(),
      };
    }
    if (supabase) {
      const { data, error } = await supabase
        .from('daily_risk_state')
        .select('*')
        .eq('trading_date', dateString)
        .eq('trading_mode', mode)
        .single();
      if (!error && data) return data;
    }
    return memStore.dailyRisk[key];
  },

  async updateDailyRiskState(dateString, mode, updates) {
    const key = `${dateString}_${mode}`;
    const current = await this.getDailyRiskState(dateString, mode);
    const updated = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    memStore.dailyRisk[key] = updated;

    if (supabase) {
      await supabase.from('daily_risk_state').upsert(updated, { onConflict: 'trading_date,trading_mode' });
    }
    return updated;
  },

  // ----------------------------------------------------------------------------
  // 8. AUDIT LOGS
  // ----------------------------------------------------------------------------
  async recordAuditLog({ eventType, relevantEntityId = null, metadata = {}, outcome = 'INFO' }) {
    const safeMetadata = { ...metadata };
    delete safeMetadata.token;
    delete safeMetadata.accessToken;
    delete safeMetadata.secretKey;
    delete safeMetadata.password;

    const record = {
      id: uuidv4(),
      event_type: eventType,
      event_timestamp: new Date().toISOString(),
      relevant_entity_id: relevantEntityId ? String(relevantEntityId) : null,
      safe_metadata: safeMetadata,
      outcome,
    };

    memStore.auditLogs.unshift(record);
    if (memStore.auditLogs.length > 500) memStore.auditLogs.pop();

    if (supabase) {
      try {
        await supabase.from('audit_logs').insert(record);
      } catch (err) {
        // Ignore DB log failures
      }
    }
    return record;
  },

  async getAuditLogs(limit = 100) {
    if (supabase) {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('event_timestamp', { ascending: false })
        .limit(limit);
      if (!error && data) return data;
    }
    return memStore.auditLogs.slice(0, limit);
  },

  // ----------------------------------------------------------------------------
  // 9. BROKER SESSION
  // ----------------------------------------------------------------------------
  async getBrokerSession() {
    if (supabase) {
      const { data, error } = await supabase.from('broker_sessions').select('*').limit(1).single();
      if (!error && data) return data;
    }
    return { ...memStore.brokerSession };
  },

  async updateBrokerSession(updates) {
    memStore.brokerSession = {
      ...memStore.brokerSession,
      ...updates,
      last_successful_connection: updates.session_status === 'CONNECTED' ? new Date().toISOString() : memStore.brokerSession.last_successful_connection,
    };
    if (supabase) {
      await supabase.from('broker_sessions').upsert(memStore.brokerSession);
    }
    return memStore.brokerSession;
  },
};
