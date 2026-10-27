/**
 * Standard Broker Interface Contract
 * Both FyersAdapter and MockBrokerAdapter implement this contract.
 */

export class IBrokerAdapter {
  async getProfile() {
    throw new Error('getProfile() not implemented');
  }

  async getFunds() {
    throw new Error('getFunds() not implemented');
  }

  async getHoldings() {
    throw new Error('getHoldings() not implemented');
  }

  async getPositions() {
    throw new Error('getPositions() not implemented');
  }

  async getOrders() {
    throw new Error('getOrders() not implemented');
  }

  async getQuotes(symbols) {
    throw new Error('getQuotes() not implemented');
  }

  async getHistoricalData({ symbol, resolution, fromDate, toDate }) {
    throw new Error('getHistoricalData() not implemented');
  }

  async placeOrder(orderPayload) {
    throw new Error('placeOrder() not implemented');
  }

  async modifyOrder(brokerOrderId, modification) {
    throw new Error('modifyOrder() not implemented');
  }

  async cancelOrder(brokerOrderId) {
    throw new Error('cancelOrder() not implemented');
  }

  async getOrderStatus(brokerOrderId) {
    throw new Error('getOrderStatus() not implemented');
  }
}
