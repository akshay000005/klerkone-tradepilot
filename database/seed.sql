-- ==============================================================================
-- KlerkOne TradePilot — Database Seed Data
-- Default user settings and initial liquid NSE equity shares watchlist
-- ==============================================================================

-- 1. Default user settings (Paper trading by default, 50,000 INR, 0.5% risk)
INSERT INTO user_settings (
    trading_mode,
    selected_strategy,
    allocated_capital,
    risk_per_trade,
    daily_loss_limit,
    maximum_open_positions,
    maximum_capital_utilisation,
    live_trading_enabled
) VALUES (
    'PAPER',
    'INTRADAY_MOMENTUM',
    50000.00,
    0.50,
    1.50,
    3,
    50.00,
    FALSE
) ON CONFLICT DO NOTHING;

-- 2. Initial high-liquidity NSE Equity Watchlist (FYERS symbol format: NSE:SYMBOL-EQ)
INSERT INTO watchlist (symbol, exchange, instrument_identifier, enabled, strategy) VALUES
    ('NSE:RELIANCE-EQ', 'NSE', 'RELIANCE', TRUE, 'INTRADAY_MOMENTUM'),
    ('NSE:TCS-EQ', 'NSE', 'TCS', TRUE, 'INTRADAY_MOMENTUM'),
    ('NSE:HDFCBANK-EQ', 'NSE', 'HDFCBANK', TRUE, 'INTRADAY_MOMENTUM'),
    ('NSE:INFY-EQ', 'NSE', 'INFY', TRUE, 'INTRADAY_MOMENTUM'),
    ('NSE:ICICIBANK-EQ', 'NSE', 'ICICIBANK', TRUE, 'INTRADAY_MOMENTUM'),
    ('NSE:SBIN-EQ', 'NSE', 'SBIN', TRUE, 'INTRADAY_MOMENTUM'),
    ('NSE:BHARTIARTL-EQ', 'NSE', 'BHARTIARTL', TRUE, 'INTRADAY_MOMENTUM'),
    ('NSE:ITC-EQ', 'NSE', 'ITC', TRUE, 'INTRADAY_MOMENTUM'),
    ('NSE:LT-EQ', 'NSE', 'LT', TRUE, 'SWING_TREND'),
    ('NSE:TATAMOTORS-EQ', 'NSE', 'TATAMOTORS', TRUE, 'SWING_TREND')
ON CONFLICT (symbol) DO NOTHING;

-- 3. Initial daily risk record for today
INSERT INTO daily_risk_state (
    trading_date,
    trading_mode,
    starting_capital,
    realised_pnl,
    unrealised_pnl,
    daily_loss_limit,
    trading_halted
) VALUES (
    CURRENT_DATE,
    'PAPER',
    50000.00,
    0.00,
    0.00,
    750.00, -- 1.5% of 50,000 INR
    FALSE
) ON CONFLICT (trading_date, trading_mode) DO NOTHING;
