import { v4 as uuidv4 } from 'uuid';
import { repository } from '../db/repository.js';
import { RiskGuardian } from '../risk/riskGuardian.js';
import { calculateIndianEquityCharges } from '../config/charges.js';

export class OrderManager {
  constructor({ brokerAdapter }) {
    this.brokerAdapter = brokerAdapter;
  }

  /**
   * Submits a new trading order through the validated lifecycle state machine.
   */
  async submitOrder({
    symbol,
    side, // 'BUY' or 'SELL'
    quantity,
    price = 0,
    triggerPrice = 0,
    orderType = 'MARKET',
    productType = 'INTRADAY',
    tradingMode = 'PAPER',
    strategy = 'INTRADAY_MOMENTUM',
    stopLoss = null,
    targetPrice = null,
    internalOrderId = null,
  }) {
    const orderId = internalOrderId || `ORD_${Date.now()}_${uuidv4().slice(0, 8)}`;

    // 1. Check for Duplicate Order Submission
    const existingOrder = await repository.getOrderByInternalId(orderId);
    if (existingOrder) {
      return {
        success: false,
        order: existingOrder,
        reason: 'Duplicate order detected. Order with this ID already processed or pending.',
      };
    }

    // 2. Initial Order State: CREATED
    const initialOrder = await repository.createOrder({
      internal_order_id: orderId,
      symbol,
      side,
      quantity,
      price,
      trigger_price: triggerPrice,
      order_type: orderType,
      product_type: productType,
      order_status: 'CREATED',
      trading_mode: tradingMode,
    });

    // 3. Pre-Trade Validation
    const settings = await repository.getUserSettings();
    const positions = await repository.getPositions(tradingMode);
    const today = new Date().toISOString().split('T')[0];
    const dailyRiskState = await repository.getDailyRiskState(today, tradingMode);

    const validation = await RiskGuardian.validatePreTrade({
      orderRequest: { symbol, side, quantity, price, orderType },
      tradingMode,
      settings,
      positions,
      dailyRiskState,
    });

    if (!validation.allowed) {
      await repository.updateOrder(orderId, {
        order_status: 'REJECTED',
        error_message: validation.reason,
      });
      await repository.recordAuditLog({
        eventType: 'ORDER_REJECTED',
        relevantEntityId: orderId,
        metadata: { symbol, side, quantity, reason: validation.reason },
        outcome: 'WARNING',
      });
      return {
        success: false,
        orderId,
        status: 'REJECTED',
        reason: validation.reason,
      };
    }

    await repository.updateOrder(orderId, { order_status: 'VALIDATED' });

    // 4. Submit to Broker
    await repository.updateOrder(orderId, { order_status: 'SUBMITTED' });

    let brokerResponse;
    try {
      brokerResponse = await this.brokerAdapter.placeOrder({
        internal_order_id: orderId,
        symbol,
        side,
        quantity,
        price,
        trigger_price: triggerPrice,
        order_type: orderType,
        product_type: productType,
      });
    } catch (err) {
      // In case of timeout or network error, mark as UNKNOWN rather than blindly failing or retrying!
      await repository.updateOrder(orderId, {
        order_status: 'UNKNOWN',
        error_message: `Broker submission uncertain: ${err.message}`,
      });
      await repository.recordAuditLog({
        eventType: 'ORDER_OUTCOME_UNCERTAIN',
        relevantEntityId: orderId,
        metadata: { symbol, error: err.message },
        outcome: 'WARNING',
      });
      return {
        success: false,
        orderId,
        status: 'UNKNOWN',
        reason: 'Order outcome uncertain. Marked as UNKNOWN. Reconciliation required before retry.',
      };
    }

    const brokerOrderId = brokerResponse.brokerOrderId;
    const filledQuantity = brokerResponse.filledQuantity || quantity;
    const tradedPrice = brokerResponse.tradedPrice || price || 1000;

    // 5. Update status to FILLED (or ACKNOWLEDGED if pending limit order)
    const isFilled = brokerResponse.status === 'FILLED' || brokerResponse.tradedPrice !== undefined;
    const finalStatus = isFilled ? 'FILLED' : 'ACKNOWLEDGED';

    await repository.updateOrder(orderId, {
      broker_order_id: brokerOrderId,
      order_status: finalStatus,
      filled_quantity: filledQuantity,
      average_fill_price: tradedPrice,
    });

    // 6. If FILLED, update Positions & Tradebook
    if (isFilled) {
      if (side === 'BUY') {
        // Open/increase position
        await repository.upsertPosition({
          symbol,
          strategy,
          quantity: filledQuantity,
          average_entry_price: tradedPrice,
          current_market_price: tradedPrice,
          current_stop_loss: stopLoss,
          current_target: targetPrice,
          trading_mode: tradingMode,
          product_type: productType,
        });
      } else if (side === 'SELL') {
        // Exit position: compute PnL, charges, and record in trades
        const existingPos = positions.find((p) => p.symbol === symbol && p.trading_mode === tradingMode);
        const entryPrice = existingPos ? existingPos.average_entry_price : tradedPrice;

        const charges = calculateIndianEquityCharges({
          buyPrice: entryPrice,
          sellPrice: tradedPrice,
          quantity: filledQuantity,
          productType,
        });

        // Record completed trade
        await repository.recordTrade({
          symbol,
          strategy,
          entry_price: entryPrice,
          exit_price: tradedPrice,
          quantity: filledQuantity,
          realised_pnl: charges.netPnL,
          estimated_charges: charges.totalCharges,
          trading_mode: tradingMode,
          exit_reason: 'MANUAL_OR_STRATEGY_EXIT',
        });

        // Update Daily Risk State with realised PnL
        const updatedRealisedPnL = Number((Number(dailyRiskState.realised_pnl) + charges.netPnL).toFixed(2));
        await repository.updateDailyRiskState(today, tradingMode, {
          realised_pnl: updatedRealisedPnL,
        });

        // Remove position
        await repository.removePosition(symbol, tradingMode);
      }
    }

    await repository.recordAuditLog({
      eventType: 'ORDER_EXECUTED',
      relevantEntityId: orderId,
      metadata: { symbol, side, quantity: filledQuantity, price: tradedPrice, status: finalStatus },
      outcome: 'SUCCESS',
    });

    return {
      success: true,
      orderId,
      brokerOrderId,
      status: finalStatus,
      tradedPrice,
      filledQuantity,
    };
  }

  /**
   * Reconciles UNKNOWN orders by querying broker order book and positions.
   */
  async reconcileUnknownOrder(internalOrderId) {
    const order = await repository.getOrderByInternalId(internalOrderId);
    if (!order || order.order_status !== 'UNKNOWN') {
      return { resolved: false, message: 'Order is not in UNKNOWN status' };
    }

    if (!order.broker_order_id) {
      // Query broker order book by tag / symbol
      const brokerOrders = await this.brokerAdapter.getOrders();
      const match = brokerOrders.find((bo) => bo.orderTag === internalOrderId || bo.symbol === order.symbol);
      if (match) {
        order.broker_order_id = match.id;
      }
    }

    if (order.broker_order_id) {
      const statusInfo = await this.brokerAdapter.getOrderStatus(order.broker_order_id);
      await repository.updateOrder(internalOrderId, {
        order_status: statusInfo.status,
        filled_quantity: statusInfo.filledQty || 0,
        average_fill_price: statusInfo.avgPrice || 0,
      });
      return { resolved: true, status: statusInfo.status };
    }

    // If order was never received by broker after reconciliation, mark CANCELLED safely
    await repository.updateOrder(internalOrderId, {
      order_status: 'CANCELLED',
      error_message: 'Reconciliation confirmed order never reached broker order book.',
    });
    return { resolved: true, status: 'CANCELLED' };
  }
}
