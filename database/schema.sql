-- ==============================================================================
-- KlerkOne TradePilot — Database Schema (Supabase / PostgreSQL)
-- Description: Complete schema for Indian equity automated trading system
-- Precision: NUMERIC types are used for all financial amounts (prevent floating point error)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. USER SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_mode VARCHAR(20) NOT NULL DEFAULT 'PAPER' CHECK (trading_mode IN ('BACKTEST', 'PAPER', 'LIVE')),
    selected_strategy VARCHAR(50) NOT NULL DEFAULT 'INTRADAY_MOMENTUM',
    allocated_capital NUMERIC(15, 2) NOT NULL DEFAULT 50000.00 CHECK (allocated_capital >= 0),
    risk_per_trade NUMERIC(5, 2) NOT NULL DEFAULT 0.50 CHECK (risk_per_trade > 0 AND risk_per_trade <= 5.0),
    daily_loss_limit NUMERIC(5, 2) NOT NULL DEFAULT 1.50 CHECK (daily_loss_limit > 0 AND daily_loss_limit <= 10.0),
    maximum_open_positions INT NOT NULL DEFAULT 3 CHECK (maximum_open_positions > 0 AND maximum_open_positions <= 20),
    maximum_capital_utilisation NUMERIC(5, 2) NOT NULL DEFAULT 50.00 CHECK (maximum_capital_utilisation > 0 AND maximum_capital_utilisation <= 100.0),
    live_trading_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. BROKER SESSIONS
-- ------------------------------------------------------------------------------
-- NEVER stores raw app secrets or raw auth tokens in plain DB columns.
CREATE TABLE IF NOT EXISTS broker_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_name VARCHAR(50) NOT NULL DEFAULT 'FYERS',
    session_status VARCHAR(30) NOT NULL DEFAULT 'DISCONNECTED' CHECK (session_status IN ('CONNECTED', 'EXPIRED', 'DISCONNECTED', 'ERROR')),
    token_expiry TIMESTAMPTZ,
    last_successful_connection TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. WATCHLIST
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(30) NOT NULL UNIQUE,
    exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
    instrument_identifier VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    strategy VARCHAR(50) NOT NULL DEFAULT 'INTRADAY_MOMENTUM',
    lot_size INT NOT NULL DEFAULT 1,
    tick_size NUMERIC(6, 2) NOT NULL DEFAULT 0.05,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_enabled ON watchlist(enabled);

-- ------------------------------------------------------------------------------
-- 4. SIGNALS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(30) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    signal_type VARCHAR(20) NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'EXIT', 'NO_TRADE')),
    candle_timestamp TIMESTAMPTZ NOT NULL,
    indicator_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    entry_price NUMERIC(15, 2),
    stop_loss NUMERIC(15, 2),
    target_price NUMERIC(15, 2),
    risk_amount NUMERIC(15, 2),
    suggested_quantity INT DEFAULT 0,
    signal_score NUMERIC(5, 2) DEFAULT 0.00,
    rejection_reason TEXT,
    conditions_met JSONB DEFAULT '[]'::jsonb,
    conditions_failed JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_order_id VARCHAR(100),
    internal_order_id VARCHAR(100) NOT NULL UNIQUE,
    symbol VARCHAR(30) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity INT NOT NULL CHECK (quantity > 0),
    filled_quantity INT NOT NULL DEFAULT 0,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    trigger_price NUMERIC(15, 2) DEFAULT 0.00,
    average_fill_price NUMERIC(15, 2) DEFAULT 0.00,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT')),
    product_type VARCHAR(20) NOT NULL DEFAULT 'INTRADAY' CHECK (product_type IN ('INTRADAY', 'CNC')),
    order_status VARCHAR(30) NOT NULL DEFAULT 'CREATED' CHECK (order_status IN (
        'CREATED', 'VALIDATED', 'SUBMITTED', 'ACKNOWLEDGED', 
        'PARTIALLY_FILLED', 'FILLED', 'REJECTED', 'CANCEL_PENDING', 
        'CANCELLED', 'UNKNOWN'
    )),
    trading_mode VARCHAR(20) NOT NULL CHECK (trading_mode IN ('BACKTEST', 'PAPER', 'LIVE')),
    error_message TEXT,
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_mode ON orders(trading_mode);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);

-- ------------------------------------------------------------------------------
-- 6. POSITIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(30) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    quantity INT NOT NULL CHECK (quantity >= 0),
    average_entry_price NUMERIC(15, 2) NOT NULL,
    current_market_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    current_stop_loss NUMERIC(15, 2),
    current_target NUMERIC(15, 2),
    unrealised_pnl NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    trading_mode VARCHAR(20) NOT NULL CHECK (trading_mode IN ('BACKTEST', 'PAPER', 'LIVE')),
    product_type VARCHAR(20) NOT NULL DEFAULT 'INTRADAY' CHECK (product_type IN ('INTRADAY', 'CNC')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_symbol_mode UNIQUE (symbol, trading_mode)
);

CREATE INDEX IF NOT EXISTS idx_positions_mode ON positions(trading_mode);

-- ------------------------------------------------------------------------------
-- 7. TRADES (CLOSED DEALS AUDIT & PNL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(30) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    entry_price NUMERIC(15, 2) NOT NULL,
    exit_price NUMERIC(15, 2) NOT NULL,
    quantity INT NOT NULL,
    realised_pnl NUMERIC(15, 2) NOT NULL,
    estimated_charges NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    actual_charges NUMERIC(15, 2) DEFAULT 0.00,
    entry_timestamp TIMESTAMPTZ NOT NULL,
    exit_timestamp TIMESTAMPTZ NOT NULL,
    trading_mode VARCHAR(20) NOT NULL CHECK (trading_mode IN ('BACKTEST', 'PAPER', 'LIVE')),
    exit_reason VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_mode ON trades(trading_mode);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_exit_time ON trades(exit_timestamp DESC);

-- ------------------------------------------------------------------------------
-- 8. DAILY RISK STATE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_risk_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_date DATE NOT NULL DEFAULT CURRENT_DATE,
    trading_mode VARCHAR(20) NOT NULL DEFAULT 'PAPER',
    starting_capital NUMERIC(15, 2) NOT NULL,
    realised_pnl NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unrealised_pnl NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    daily_loss_limit NUMERIC(15, 2) NOT NULL,
    trading_halted BOOLEAN NOT NULL DEFAULT FALSE,
    halt_reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_date_mode UNIQUE (trading_date, trading_mode)
);

-- ------------------------------------------------------------------------------
-- 9. AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    relevant_entity_id VARCHAR(100),
    safe_metadata JSONB DEFAULT '{}'::jsonb,
    outcome VARCHAR(30) NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'WARNING', 'INFO'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(event_timestamp DESC);

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_risk_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full unrestricted access
DO $$
BEGIN
    DROP POLICY IF EXISTS service_role_all_user_settings ON user_settings;
    CREATE POLICY service_role_all_user_settings ON user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_broker_sessions ON broker_sessions;
    CREATE POLICY service_role_all_broker_sessions ON broker_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_watchlist ON watchlist;
    CREATE POLICY service_role_all_watchlist ON watchlist FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_signals ON signals;
    CREATE POLICY service_role_all_signals ON signals FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_orders ON orders;
    CREATE POLICY service_role_all_orders ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_positions ON positions;
    CREATE POLICY service_role_all_positions ON positions FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_trades ON trades;
    CREATE POLICY service_role_all_trades ON trades FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_daily_risk_state ON daily_risk_state;
    CREATE POLICY service_role_all_daily_risk_state ON daily_risk_state FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_audit_logs ON audit_logs;
    CREATE POLICY service_role_all_audit_logs ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;
