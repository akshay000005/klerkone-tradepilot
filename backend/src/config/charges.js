/**
 * Indian Equity Market Statutory Charges & Brokerage Calculator (NSE)
 * Compliant with SEBI, Exchange, Government Stamp Duty, and FYERS tariff rates.
 * 
 * Rules for Equity Cash:
 * 
 * 1. Brokerage:
 *    - Intraday (MIS): Flat ₹20 or 0.03% (whichever is lower) per executed order.
 *    - Delivery (CNC): ₹0 (Zero brokerage).
 * 
 * 2. STT (Securities Transaction Tax):
 *    - Intraday (MIS): 0.025% on Sell side only.
 *    - Delivery (CNC): 0.1% on both Buy and Sell sides.
 * 
 * 3. Exchange Transaction Charges (NSE):
 *    - 0.00297% (approx ₹297 per crore) on both Buy and Sell turnover.
 * 
 * 4. SEBI Turnover Charges:
 *    - ₹10 per crore (0.0001%) on both Buy and Sell turnover.
 * 
 * 5. Stamp Duty:
 *    - Intraday: 0.003% (₹300 per crore) on Buy side turnover.
 *    - Delivery: 0.015% (₹1500 per crore) on Buy side turnover.
 * 
 * 6. GST (Goods & Services Tax):
 *    - 18% on (Brokerage + Exchange Transaction Charges + SEBI Turnover Charges).
 */

export function calculateTurnover(price, quantity) {
  return Number((Number(price) * Number(quantity)).toFixed(2));
}

export function calculateIndianEquityCharges({
  buyPrice,
  sellPrice,
  quantity,
  productType = 'INTRADAY', // 'INTRADAY' or 'CNC'
}) {
  const qty = Number(quantity);
  const bPrice = Number(buyPrice);
  const sPrice = Number(sellPrice);

  const buyTurnover = calculateTurnover(bPrice, qty);
  const sellTurnover = calculateTurnover(sPrice, qty);
  const totalTurnover = Number((buyTurnover + sellTurnover).toFixed(2));

  // 1. Brokerage
  let buyBrokerage = 0;
  let sellBrokerage = 0;
  if (productType === 'INTRADAY') {
    buyBrokerage = Math.min(20, Number((buyTurnover * 0.0003).toFixed(2)));
    sellBrokerage = Math.min(20, Number((sellTurnover * 0.0003).toFixed(2)));
  } else {
    // FYERS equity delivery is ₹0 brokerage
    buyBrokerage = 0;
    sellBrokerage = 0;
  }
  const totalBrokerage = Number((buyBrokerage + sellBrokerage).toFixed(2));

  // 2. STT (Securities Transaction Tax) - Rounded as per statutory norms
  let stt = 0;
  if (productType === 'INTRADAY') {
    // 0.025% on sell side only
    stt = Math.round(sellTurnover * 0.00025);
  } else {
    // 0.1% on both buy and sell
    stt = Math.round(totalTurnover * 0.001);
  }

  // 3. Exchange Transaction Charges (NSE: 0.00297%)
  const exchangeCharges = Number((totalTurnover * 0.0000297).toFixed(2));

  // 4. SEBI Turnover Charges (₹10 / crore = 0.0001%)
  const sebiCharges = Number((totalTurnover * 0.000001).toFixed(2));

  // 5. Stamp Duty (on Buy side turnover only)
  let stampDuty = 0;
  if (productType === 'INTRADAY') {
    // 0.003% on buy
    stampDuty = Math.round(buyTurnover * 0.00003);
  } else {
    // 0.015% on buy
    stampDuty = Math.round(buyTurnover * 0.00015);
  }

  // 6. GST (18% on Brokerage + Exchange Charges + SEBI Charges)
  const gstBase = totalBrokerage + exchangeCharges + sebiCharges;
  const gst = Number((gstBase * 0.18).toFixed(2));

  // Total Statutory and Execution Charges
  const totalCharges = Number(
    (totalBrokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst).toFixed(2)
  );

  // Gross P&L and Net P&L
  const grossPnL = Number((sellTurnover - buyTurnover).toFixed(2));
  const netPnL = Number((grossPnL - totalCharges).toFixed(2));

  // Breakeven price movement required per share
  const breakevenPointsPerShare = qty > 0 ? Number((totalCharges / qty).toFixed(2)) : 0;

  return {
    buyTurnover,
    sellTurnover,
    totalTurnover,
    brokerage: totalBrokerage,
    stt,
    exchangeCharges,
    sebiCharges,
    stampDuty,
    gst,
    totalCharges,
    grossPnL,
    netPnL,
    breakevenPointsPerShare,
  };
}
