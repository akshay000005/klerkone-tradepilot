# KlerkOne TradePilot — Automated Indian Stock Trading Platform

**KlerkOne TradePilot** is an institutional-grade, modular algorithmic and discretionary trading platform engineered for the Indian equity markets (NSE). It integrates directly with the **FYERS API v3**, **Supabase / PostgreSQL**, a **Node.js (ES Modules) backend**, and a **React + Vite + Tailwind CSS + Recharts** frontend.

---

## 📑 Table of Contents

1. [Key Architecture & Design Principles](#1-key-architecture--design-principles)
2. [Application Modes (Backtest, Paper, Live)](#2-application-modes)
3. [Technology Stack](#3-technology-stack)
4. [Project Directory Structure](#4-project-directory-structure)
5. [Prerequisites & External Services](#5-prerequisites--external-services)
6. [Installation & Setup Step-by-Step](#6-installation--setup-step-by-step)
7. [Database Setup (Supabase / PostgreSQL)](#7-database-setup)
8. [FYERS API v3 Integration Guide](#8-fyers-api-v3-integration-guide)
9. [Quantitative Strategies & Indicators](#9-quantitative-strategies--indicators)
10. [Dynamic Capital Management & Risk Controls](#10-dynamic-capital-management--risk-controls)
11. [Indian Equity Statutory Charges & Cost Model](#11-indian-equity-statutory-charges--cost-model)
12. [Order Lifecycle & Rebalancing State Machine](#12-order-lifecycle--rebalancing-state-machine)
13. [Emergency Kill Switch & Circuit Breakers](#13-emergency-kill-switch--circuit-breakers)
14. [Automated Testing Suite](#14-automated-testing-suite)
15. [Production Deployment Guide](#15-production-deployment-guide)
16. [Security & Regulatory Compliance Checklist](#16-security--regulatory-compliance-checklist)
17. [Troubleshooting Guide](#17-troubleshooting-guide)

---

## 1. Key Architecture & Design Principles

- **Capital Preservation First:** All trades strictly obey fractional position sizing (default 0.5% risk per trade) and automatic circuit breakers (1.5% daily loss cap).
- **Disabled-By-Default Live Trading:** The platform initializes strictly in **PAPER TRADING** mode. Live execution requires explicit configuration, verified broker sessions, and user confirmation.
- **Explainable Signals:** Every trade recommendation includes an auditable breakdown of conditions met, conditions failed, dynamic stop-loss, and target levels.
- **Zero Look-Ahead Bias:** Backtesting operates bar-by-bar strictly on completed historical candles with realistic slippage and statutory exchange charges.
- **Zero Secret Leakage:** Broker API secrets and access tokens reside strictly in backend memory and environment variables; they are never sent to the browser or committed to source control.

---

## 2. Application Modes

| Mode | Purpose | Broker Connection | Risk Enforcement | Capital Used |
| :--- | :--- | :--- | :--- | :--- |
| **BACKTEST** | Simulate historical performance | None (Historical data only) | Simulated | Virtual |
| **PAPER TRADING** | Forward-test live market dynamics | Realtime quotes / Simulation | Fully enforced | Simulated Virtual Portfolio |
| **LIVE TRADING** | Real execution via FYERS API | Official FYERS API v3 | Multi-layer pre-trade check | Real Trading Capital |

> [!IMPORTANT]
> Mode switching is strictly blocked while open positions exist to prevent stranded orders or inadvertent exposure.

---

## 3. Technology Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend:** Node.js (ES Modules), Express.js, WebSockets (`ws`), Zod validation
- **Broker Interface:** FYERS API v3 (`fyers-api-v3` & direct REST endpoints)
- **Database:** Supabase PostgreSQL with Row Level Security (RLS) & local transactional fallback
- **Testing:** Vitest, Supertest

---

## 4. Project Directory Structure

```text
TRADING SOFTWARE/
├── .env.example                   # Master environment template
├── package.json                   # Root scripts runner
├── scripts/
│   └── dev.js                     # Unified dev runner (Backend + Frontend)
├── database/
│   ├── schema.sql                 # Supabase PostgreSQL schema with RLS & indexes
│   └── seed.sql                   # Default settings & liquid NSE watchlist
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js              # Express app & WebSocket server
│   │   ├── config/
│   │   │   ├── env.js             # Validated environment configuration
│   │   │   └── charges.js         # Indian statutory charges (STT, GST, Stamp, NSE)
│   │   ├── db/
│   │   │   ├── client.js          # Supabase client wrapper
│   │   │   └── repository.js      # Data access layer & in-memory test store
│   │   ├── broker/
│   │   │   ├── interface.js       # Broker abstraction contract
│   │   │   ├── fyers/
│   │   │   │   ├── auth.js        # FYERS OAuth & SHA-256 appIdHash flow
│   │   │   │   ├── client.js      # FYERS REST v3 client
│   │   │   │   └── mapper.js      # Status code & order type mappers
│   │   │   └── mock/
│   │   │       └── mockBroker.js  # High-fidelity Paper Trading broker
│   │   ├── indicators/
│   │   │   ├── ema.js             # Exponential Moving Average
│   │   │   ├── rsi.js             # Wilder's Relative Strength Index
│   │   │   ├── atr.js             # Average True Range
│   │   │   ├── volume.js          # Relative Volume (RVOL)
│   │   │   └── syntheticData.js   # Deterministic synthetic candle generator
│   │   ├── strategies/
│   │   │   ├── intradayMomentum.js# Strategy A: Intraday Momentum
│   │   │   ├── swingTrend.js      # Strategy B: Swing Trend Following
│   │   │   └── scorer.js          # Explainable condition scoring engine
│   │   ├── risk/
│   │   │   ├── capitalManager.js  # Effective capital & risk position sizing
│   │   │   ├── riskGuardian.js    # Pre-trade invariant enforcement
│   │   │   └── killSwitch.js      # Emergency freeze & liquidation engine
│   │   ├── execution/
│   │   │   ├── orderManager.js    # State machine & idempotency tracker
│   │   │   └── reconciler.js      # Broker position & order reconciler
│   │   ├── backtest/
│   │   │   ├── engine.js          # Chronological bar-by-bar backtest engine
│   │   │   ├── metrics.js         # Sharpe, Sortino, Drawdown, Expectancy
│   │   │   └── sensitivity.js     # Parameter perturbation analysis
│   │   ├── ai/
│   │   │   └── newsAnalyzer.js    # Optional news sentiment analyzer
│   │   └── routes/
│   │       └── api.js             # Express REST router
│   └── tests/                     # Vitest automated test suites
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx                # Layout & page routing
        ├── context/
        │   ├── TradingContext.jsx # Global trading state & telemetry
        │   └── ToastContext.jsx   # Non-blocking notification toasts
        ├── components/
        │   ├── Header.jsx         # Status bar, Kill Switch, Mode switcher
        │   ├── Navbar.jsx         # 8-page tab navigation
        │   └── ConfirmationModal.jsx # Danger & action confirmation dialog
        └── pages/
            ├── Overview.jsx       # Page 1: Dashboard, KPIs, Risk usage
            ├── Scanner.jsx        # Page 2: Realtime scanner & signal breakdown
            ├── Positions.jsx      # Page 3: Open positions & safe manual exit
            ├── Orders.jsx         # Page 4: Orderbook & Tradebook
            ├── StrategyConfig.jsx # Page 5: Risk parameters & watchlist manager
            ├── Backtesting.jsx    # Page 6: Backtest runner & equity curve
            ├── Reports.jsx        # Page 7: P&L analytics & statutory fees
            └── Settings.jsx       # Page 8: FYERS OAuth & Live safety gate
```

---

## 5. Prerequisites & External Services

| Service | Purpose | Pricing / Cost | Mandatory? |
| :--- | :--- | :--- | :--- |
| **Node.js 18+** | Runtime environment | Free / Open-source | Yes |
| **Supabase** | PostgreSQL database with RLS | Free tier (up to 500MB DB) | Recommended (app has local fallback) |
| **FYERS API v3** | Indian equity market broker | Free for retail API users | Required for Live Mode |
| **OpenAI / Anthropic** | Financial news sentiment parsing | Pay-as-you-go | Optional (Mock heuristic included) |

---

## 6. Installation & Setup Step-by-Step

### Step 1: Install All Dependencies
From the project root:
```powershell
npm run install:all
```
This automatically installs dependencies for the root, `backend/`, and `frontend/`.

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
Open `.env` in any text editor and fill in your details:
- **Default Allocated Capital:** `DEFAULT_ALLOCATED_CAPITAL=50000`
- **Supabase Credentials:** (Optional during first boot)
- **FYERS Credentials:** (Needed for live broker connection)

### Step 3: Run the Development Platform
Run both backend API (Port 5000) and frontend dashboard (Port 5173) simultaneously:
```powershell
npm run dev
```
Open your browser to: **`http://localhost:5173`**

---

## 7. Database Setup (Supabase / PostgreSQL)

1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project (e.g. `klerkone-tradepilot`).
3. Navigate to **SQL Editor** in the Supabase Dashboard.
4. Copy the entire contents of `database/schema.sql` and click **Run**.
5. Copy the contents of `database/seed.sql` and click **Run**.
6. Navigate to **Project Settings -> API** and copy:
   - **Project URL** into `SUPABASE_URL` in `.env`
   - **Service Role Secret Key** into `SUPABASE_SERVICE_ROLE_KEY` in `.env`

> [!NOTE]
> If Supabase credentials are not supplied, TradePilot automatically operates using its built-in in-memory transactional store. You can test Paper trading, backtesting, and scanner immediately with zero errors!

---

## 8. FYERS API v3 Integration Guide

### Step 1: Register an App on FYERS
1. Log in to [FYERS API Dashboard](https://myapi.fyers.in/dashboard).
2. Click **Create App**.
3. Set **App Name**: `KlerkOne TradePilot`.
4. Set **Redirect URL**: `http://localhost:5000/api/v1/broker/fyers/callback`.
5. Grant permissions: Quotes, Orders, Positions, Historical Data.
6. Copy your **App ID** (Client ID) and **Secret Key** into `.env`:
   ```env
   FYERS_APP_ID=YOUR_APP_ID
   FYERS_SECRET_KEY=YOUR_SECRET_KEY
   ```

### Step 2: Authorize Your Daily Session
1. In the TradePilot dashboard, navigate to **Settings & Security**.
2. Under **FYERS Broker Integration**, click **Authorize / Connect FYERS API v3**.
3. Log in with your FYERS mobile number, PIN, and TOTP in the popup.
4. FYERS will redirect back to the local callback handler, automatically generating and activating your daily token.

---

## 9. Quantitative Strategies & Indicators

### Strategy A: Intraday Momentum & Trend Following (5m / 15m)
- **EMA 20 & EMA 50:** Price > EMA 20 and EMA 20 > EMA 50 confirms bullish alignment.
- **RSI 14:** Bounded between 55 and 70 to ensure active momentum without severe overbought exhaustion.
- **Relative Volume (RVOL):** Evaluates today's bar volume against the preceding moving average (`RVOL >= 1.0`).
- **ATR 14 Sizing:** Volatility-adjusted stop-loss set to `1.5 * ATR` and target set to `3.0 * ATR` (minimum 1:2 risk-to-reward ratio).

### Strategy B: Swing Trend Following (Daily)
- Analyzes daily candles for multi-day directional trends.
- Price > EMA 20, EMA 20 > EMA 50, RSI > 50, liquidity filters.
- Positions are held across multiple days without intraday square-off.

---

## 10. Dynamic Capital Management & Risk Controls

TradePilot calculates order quantities dynamically using:
$$\text{Effective Capital} = \min(\text{Verified Available Funds}, \text{User Allocated Capital})$$

$$\text{Planned Risk Amount} = \text{Effective Capital} \times \left(\frac{\text{Risk Per Trade \%}}{100}\right)$$

$$\text{Risk Quantity} = \left\lfloor \frac{\text{Planned Risk Amount}}{\text{Entry Price} - \text{Stop-Loss Price}} \right\rfloor$$

$$\text{Capital Capped Quantity} = \left\lfloor \frac{\text{Effective Capital} \times \text{Max Utilisation \%}}{\text{Entry Price}} \right\rfloor$$

$$\text{Final Order Quantity} = \min(\text{Risk Quantity}, \text{Capital Capped Quantity})$$

---

## 11. Indian Equity Statutory Charges & Cost Model

The exact cost model for NSE Cash trading implemented in `backend/src/config/charges.js`:

| Fee / Statutory Tax | Intraday (MIS) Rate | Delivery (CNC) Rate |
| :--- | :--- | :--- |
| **Brokerage (FYERS)** | Flat ₹20 or 0.03% (whichever lower) | ₹0 (Zero brokerage) |
| **STT** | 0.025% on Sell turnover only | 0.1% on Buy & Sell turnover |
| **Exchange Turnover (NSE)** | 0.00297% on Buy & Sell | 0.00297% on Buy & Sell |
| **SEBI Turnover Charges** | ₹10 / crore (0.0001%) | ₹10 / crore (0.0001%) |
| **Stamp Duty** | 0.003% on Buy turnover | 0.015% on Buy turnover |
| **GST** | 18% on (Brokerage + Exchange + SEBI) | 18% on (Exchange + SEBI) |

---

## 12. Order Lifecycle & Rebalancing State Machine

Every order moves through a strict state machine:
```text
CREATED ➔ VALIDATED ➔ SUBMITTED ➔ ACKNOWLEDGED ➔ PARTIALLY_FILLED ➔ FILLED
                                              ↘ REJECTED
                                              ↘ CANCELLED
                                              ↘ UNKNOWN (Triggers auto-reconciliation)
```
- **Duplicate Prevention:** Internal UUID order tags guarantee idempotency.
- **Unknown Status Handling:** Network timeouts mark orders as `UNKNOWN`. TradePilot queries the broker tradebook before any retry to prevent duplicate order placement.
- **Shorting Protection:** Exits are verified against open position sizes to prevent accidental short positions.

---

## 13. Emergency Kill Switch & Circuit Breakers

1. **Daily Circuit Breaker:** When total daily loss reaches the configured limit (default 1.5%), all new entries are frozen immediately. Open positions continue to be monitored for stop-loss execution.
2. **One-Click Kill Switch:** Available at the top of every dashboard screen. Freezes the engine instantly and optionally triggers emergency market square-off of open positions.

---

## 14. Automated Testing Suite

Run all automated unit and integration tests:
```powershell
npm test
```
The test suite validates:
- [x] Exponential Moving Average (EMA) mathematical accuracy and warmup handling
- [x] Wilder's Relative Strength Index (RSI) bounds and exponential smoothing
- [x] Average True Range (ATR) volatility calculations
- [x] Relative Volume (RVOL) against prior volume averages
- [x] Full Indian statutory charge calculations (STT, GST, Stamp, Exchange, Brokerage)
- [x] Strategy A & Strategy B explainable signal scoring
- [x] Chronological backtesting with zero look-ahead bias and slippage
- [x] Walk-forward parameter sensitivity analysis
- [x] Whole-share risk-based position sizing
- [x] RiskGuardian pre-trade daily loss circuit breaker blocking
- [x] Maximum open positions limit enforcement
- [x] Idempotent duplicate-order prevention
- [x] Unknown order outcome timeout recovery and reconciliation
- [x] Live trading isolation gate (live orders blocked when disabled)
- [x] Emergency kill switch immediate activation and reset

---

## 15. Production Deployment Guide

### Backend & Trading Worker (Cloud VM / VPS)
- Deploy on any reliable Linux VPS (AWS EC2, DigitalOcean Droplet, Hetzner, etc.).
- Static outbound IP: If required by your broker for API access, attach an Elastic IP.
- Process Manager: Use `pm2` for continuous uptime and auto-restart on crashes:
  ```bash
  npm install -g pm2
  cd backend
  pm2 start src/server.js --name tradepilot-backend
  pm2 save
  ```

### Frontend Dashboard (Static Hosting)
- Deploy the frontend to Vercel, Netlify, or Cloudflare Pages:
  ```bash
  cd frontend
  npm run build
  ```
- Upload the contents of `frontend/dist/` to your static host.

---

## 16. Security & Regulatory Compliance Checklist

- [x] Secrets redacted from all console and application logs.
- [x] No broker API secrets or access tokens present in client browser code.
- [x] Row Level Security (RLS) policies enabled across all database tables.
- [x] Rate limiting configured on all REST endpoints.
- [x] Mandatory manual confirmation dialog before unlocking Live Trading.
- [x] Compliant with SEBI retail algorithmic trading guidelines.
- [x] No guaranteed profits or fabricated returns advertised.

---

## 17. Troubleshooting Guide

### 1. "FYERS Broker Session inactive: Access Token is missing or expired"
- **Solution:** FYERS OAuth tokens expire every 24 hours. Navigate to **Settings & Security** and click **Authorize / Connect FYERS API v3**.

### 2. "Trading is currently halted. Reason: Daily loss limit breached"
- **Solution:** The automatic circuit breaker triggered to protect capital after today's losses reached the 1.5% limit. Click **Reset Circuit Breaker** in the top navigation bar to resume monitoring.

### 3. "Cannot switch trading mode while positions are open"
- **Solution:** Navigate to the **Positions** page and square off open positions before switching between PAPER and LIVE modes.

### 4. "Database fallback active"
- **Solution:** This is normal if you have not configured Supabase credentials. TradePilot runs out-of-the-box on its high-fidelity in-memory store. To persist data to the cloud, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env`.
