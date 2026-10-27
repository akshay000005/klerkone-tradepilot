import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePositionSize, calculateEffectiveCapital } from '../src/risk/capitalManager.js';
import { RiskGuardian } from '../src/risk/riskGuardian.js';
import { OrderManager } from '../src/execution/orderManager.js';
import { MockBrokerAdapter } from '../src/broker/mock/mockBroker.js';
import { repository } from '../src/db/repository.js';
import { KillSwitch } from '../src/risk/killSwitch.js';

describe('Risk Management & Order Execution Machine', () => {
  beforeEach(() => {
    repository.resetForTesting();
  });

  describe('Dynamic Capital & Position Sizing', () => {
    it('should use the minimum of verified available funds and user-defined capital limit', () => {
      expect(calculateEffectiveCapital({ verifiedAvailableFunds: 40000, userAllocatedCapital: 50000 })).toBe(40000);
      expect(calculateEffectiveCapital({ verifiedAvailableFunds: 100000, userAllocatedCapital: 30000 })).toBe(30000);
    });

    it('should accurately calculate risk-based whole-share quantity according to example specifications', () => {
      const sizing = calculatePositionSize({
        effectiveCapital: 30000,
        entryPrice: 1000,
        stopLossPrice: 990,
        riskPerTradePercent: 0.5,
        maxCapitalUtilisationPercent: 50.0,
      });

      expect(sizing.isValid).toBe(true);
      expect(sizing.quantity).toBe(15);
      expect(sizing.riskPerShare).toBe(10);
      expect(sizing.maxRiskAmount).toBe(150);
      expect(sizing.plannedRisk).toBe(150);
    });

    it('should reject trades when stop-loss is invalid (greater than or equal to entry)', () => {
      const sizing = calculatePositionSize({
        effectiveCapital: 50000,
        entryPrice: 500,
        stopLossPrice: 520,
      });
      expect(sizing.isValid).toBe(false);
      expect(sizing.quantity).toBe(0);
      expect(sizing.reason).toContain('strictly below entry');
    });
  });

  describe('RiskGuardian Limit Enforcement', () => {
    it('should reject new entries when daily loss limit is breached', async () => {
      const validation = await RiskGuardian.validatePreTrade({
        orderRequest: { symbol: 'NSE:SBIN-EQ', side: 'BUY', quantity: 10, price: 800 },
        tradingMode: 'PAPER',
        settings: { maximum_open_positions: 3, allocated_capital: 50000, maximum_capital_utilisation: 50 },
        positions: [],
        dailyRiskState: {
          trading_date: '2026-10-27',
          trading_halted: false,
          realised_pnl: -800,
          unrealised_pnl: 0,
          daily_loss_limit: 750,
        },
      });

      expect(validation.allowed).toBe(false);
      expect(validation.code).toBe('DAILY_LOSS_LIMIT_BREACHED');
      expect(validation.reason).toContain('Daily loss limit breached');
    });

    it('should reject new entries when maximum open positions limit is reached', async () => {
      const existingPositions = [
        { symbol: 'NSE:RELIANCE-EQ', quantity: 10, average_entry_price: 2500, trading_mode: 'PAPER' },
        { symbol: 'NSE:TCS-EQ', quantity: 5, average_entry_price: 3800, trading_mode: 'PAPER' },
        { symbol: 'NSE:INFY-EQ', quantity: 15, average_entry_price: 1700, trading_mode: 'PAPER' },
      ];

      const validation = await RiskGuardian.validatePreTrade({
        orderRequest: { symbol: 'NSE:SBIN-EQ', side: 'BUY', quantity: 10, price: 800 },
        tradingMode: 'PAPER',
        settings: { maximum_open_positions: 3, allocated_capital: 100000, maximum_capital_utilisation: 80 },
        positions: existingPositions,
        dailyRiskState: { trading_halted: false, realised_pnl: 0, unrealised_pnl: 0, daily_loss_limit: 1500 },
      });

      expect(validation.allowed).toBe(false);
      expect(validation.code).toBe('MAX_POSITIONS_REACHED');
    });

    it('should block live orders if live_trading_enabled is false', async () => {
      const validation = await RiskGuardian.validatePreTrade({
        orderRequest: { symbol: 'NSE:SBIN-EQ', side: 'BUY', quantity: 5, price: 800 },
        tradingMode: 'LIVE',
        settings: { live_trading_enabled: false, maximum_open_positions: 3, allocated_capital: 50000, maximum_capital_utilisation: 50 },
        positions: [],
        dailyRiskState: { trading_halted: false, realised_pnl: 0, unrealised_pnl: 0, daily_loss_limit: 750 },
      });

      expect(validation.allowed).toBe(false);
      expect(validation.code).toBe('LIVE_TRADING_DISABLED');
    });
  });

  describe('OrderManager & Uncertain Outcome Resolution', () => {
    it('should prevent duplicate order submissions with identical internal order IDs', async () => {
      const broker = new MockBrokerAdapter();
      const om = new OrderManager({ brokerAdapter: broker });
      const internalId = 'TEST_IDEMP_001';

      // First submission
      const res1 = await om.submitOrder({
        symbol: 'NSE:HDFCBANK-EQ',
        side: 'BUY',
        quantity: 5,
        price: 1650,
        internalOrderId: internalId,
        tradingMode: 'PAPER',
      });
      expect(res1.success).toBe(true);

      // Duplicate submission
      const res2 = await om.submitOrder({
        symbol: 'NSE:HDFCBANK-EQ',
        side: 'BUY',
        quantity: 5,
        price: 1650,
        internalOrderId: internalId,
        tradingMode: 'PAPER',
      });
      expect(res2.success).toBe(false);
      expect(res2.reason).toContain('Duplicate order detected');
    });

    it('should mark an order as UNKNOWN upon network timeout and reconcile before retrying', async () => {
      const brokenBroker = {
        async placeOrder() {
          throw new Error('ETIMEDOUT: Connection timed out to broker gateway');
        },
        async getOrders() {
          return [{ id: 'BROKER_RECONCILED_123', orderTag: 'UNKNOWN_TEST_002', status: 2, qty: 5, filledQty: 5, tradedPrice: 1650 }];
        },
        async getOrderStatus() {
          return { status: 'FILLED', brokerOrderId: 'BROKER_RECONCILED_123', filledQty: 5, avgPrice: 1650 };
        },
      };

      const om = new OrderManager({ brokerAdapter: brokenBroker });
      const internalId = 'UNKNOWN_TEST_002';

      const res = await om.submitOrder({
        symbol: 'NSE:HDFCBANK-EQ',
        side: 'BUY',
        quantity: 5,
        price: 1650,
        internalOrderId: internalId,
        tradingMode: 'PAPER',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('UNKNOWN');

      // Now run reconciliation
      const reconResult = await om.reconcileUnknownOrder(internalId);
      expect(reconResult.resolved).toBe(true);
      expect(reconResult.status).toBe('FILLED');

      const savedOrder = await repository.getOrderByInternalId(internalId);
      expect(savedOrder.order_status).toBe('FILLED');
    });
  });

  describe('Emergency Kill Switch', () => {
    it('should halt trading and disable live trading flag immediately upon activation', async () => {
      const res = await KillSwitch.activateKillSwitch({
        reason: 'Volatility spike circuit trigger',
        squareOffAllPositions: false,
        tradingMode: 'PAPER',
      });

      expect(res.tradingHalted).toBe(true);
      const settings = await repository.getUserSettings();
      expect(settings.live_trading_enabled).toBe(false);
    });
  });
});
