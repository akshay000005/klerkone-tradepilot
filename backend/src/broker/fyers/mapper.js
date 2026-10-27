/**
 * FYERS API v3 to TradePilot Internal Order Lifecycle Status Mapper
 * 
 * Internal lifecycle states:
 * CREATED -> VALIDATED -> SUBMITTED -> ACKNOWLEDGED -> PARTIALLY_FILLED -> FILLED -> CANCELLED -> REJECTED -> UNKNOWN
 */

export function mapFyersOrderStatus(fyersStatus, qty = 0, filledQty = 0) {
  // If there are partial fills
  if (filledQty > 0 && filledQty < qty) {
    return 'PARTIALLY_FILLED';
  }

  // FYERS standard status codes
  switch (Number(fyersStatus)) {
    case 1:
      return 'CANCELLED';
    case 2:
      return 'FILLED';
    case 4:
      return 'ACKNOWLEDGED'; // Transit / Sent to Exchange
    case 5:
      return 'REJECTED';
    case 6:
      return 'ACKNOWLEDGED'; // Pending in orderbook
    default:
      return 'UNKNOWN';
  }
}

export function mapInternalToFyersOrderType(orderType) {
  switch (orderType) {
    case 'LIMIT':
      return 1;
    case 'MARKET':
      return 2;
    case 'STOP':
      return 3; // SL-M (Stop Market)
    case 'STOP_LIMIT':
      return 4; // SL-L (Stop Limit)
    default:
      return 2; // Default to Market
  }
}

export function mapInternalToFyersSide(side) {
  return side === 'BUY' ? 1 : -1;
}

export function mapFyersSideToInternal(side) {
  return Number(side) === 1 ? 'BUY' : 'SELL';
}
