import { repository } from '../db/repository.js';

export class PortfolioReconciler {
  constructor({ brokerAdapter }) {
    this.brokerAdapter = brokerAdapter;
  }

  /**
   * Reconciles internal active positions against broker positions.
   * Flags discrepancies and logs discrepancies safely.
   */
  async reconcilePositions(tradingMode = 'PAPER') {
    if (tradingMode !== 'LIVE') {
      // In paper mode, internal repository is the single source of truth
      const positions = await repository.getPositions('PAPER');
      return {
        matched: true,
        mode: 'PAPER',
        discrepancies: [],
        positionsCount: positions.length,
      };
    }

    try {
      const brokerPositions = await this.brokerAdapter.getPositions();
      const internalPositions = await repository.getPositions('LIVE');
      const discrepancies = [];

      // Check each internal position against broker
      for (const intPos of internalPositions) {
        const netBrokerPos = brokerPositions.netPositions?.find((p) => p.symbol === intPos.symbol);
        const brokerQty = netBrokerPos ? netBrokerPos.netQty : 0;

        if (brokerQty !== intPos.quantity) {
          discrepancies.push({
            symbol: intPos.symbol,
            internalQuantity: intPos.quantity,
            brokerQuantity: brokerQty,
            action: 'DISCREPANCY_DETECTED',
          });
        }
      }

      if (discrepancies.length > 0) {
        await repository.recordAuditLog({
          eventType: 'RECONCILIATION_DISCREPANCY',
          metadata: { discrepancies },
          outcome: 'WARNING',
        });
      }

      return {
        matched: discrepancies.length === 0,
        mode: 'LIVE',
        discrepancies,
      };
    } catch (err) {
      return {
        matched: false,
        mode: 'LIVE',
        error: err.message,
        discrepancies: [],
      };
    }
  }
}
