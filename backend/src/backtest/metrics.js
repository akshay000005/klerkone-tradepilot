/**
 * Quantitative Performance & Risk Analytics Calculator
 * Computes industry-standard metrics: PnL, Drawdown, Win Rate, Profit Factor, Sharpe Ratio.
 */

export function calculatePerformanceMetrics({
  initialCapital,
  trades = [],
  equityCurve = [],
}) {
  const initCap = Number(initialCapital) || 50000;
  const totalTrades = trades.length;

  if (totalTrades === 0) {
    return {
      initialCapital: initCap,
      endingCapital: initCap,
      netPnL: 0,
      returnPercent: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      winRate: 0,
      profitFactor: 0,
      averageTrade: 0,
      averageWin: 0,
      averageLoss: 0,
      maxDrawdownAmount: 0,
      maxDrawdownPercent: 0,
      expectancy: 0,
      totalCharges: 0,
      sharpeRatio: 0,
      equityCurve: [{ timestamp: new Date().toISOString(), equity: initCap, drawdown: 0 }],
    };
  }

  let grossProfits = 0;
  let grossLosses = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakevenTrades = 0;
  let totalCharges = 0;
  let winSum = 0;
  let lossSum = 0;

  for (const t of trades) {
    const net = Number(t.realised_pnl);
    totalCharges += Number(t.estimated_charges || 0);

    if (net > 0) {
      winningTrades++;
      grossProfits += net;
      winSum += net;
    } else if (net < 0) {
      losingTrades++;
      grossLosses += Math.abs(net);
      lossSum += Math.abs(net);
    } else {
      breakevenTrades++;
    }
  }

  const netPnL = Number((grossProfits - grossLosses).toFixed(2));
  const endingCapital = Number((initCap + netPnL).toFixed(2));
  const returnPercent = Number(((netPnL / initCap) * 100).toFixed(2));
  const winRate = Number(((winningTrades / totalTrades) * 100).toFixed(2));
  const profitFactor = grossLosses > 0 ? Number((grossProfits / grossLosses).toFixed(2)) : grossProfits > 0 ? 99.99 : 0;

  const averageWin = winningTrades > 0 ? Number((winSum / winningTrades).toFixed(2)) : 0;
  const averageLoss = losingTrades > 0 ? Number((lossSum / losingTrades).toFixed(2)) : 0;
  const averageTrade = Number((netPnL / totalTrades).toFixed(2));

  // Mathematical Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
  const winProbability = winningTrades / totalTrades;
  const lossProbability = losingTrades / totalTrades;
  const expectancy = Number(((winProbability * averageWin) - (lossProbability * averageLoss)).toFixed(2));

  // Drawdown calculation from equity curve
  let peak = initCap;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  for (const pt of equityCurve) {
    if (pt.equity > peak) {
      peak = pt.equity;
    }
    const currentDdAmount = peak - pt.equity;
    const currentDdPercent = peak > 0 ? (currentDdAmount / peak) * 100 : 0;

    if (currentDdAmount > maxDrawdownAmount) {
      maxDrawdownAmount = Number(currentDdAmount.toFixed(2));
    }
    if (currentDdPercent > maxDrawdownPercent) {
      maxDrawdownPercent = Number(currentDdPercent.toFixed(2));
    }
  }

  // Annualized Sharpe Ratio approximation (assuming 252 trading days)
  let sharpeRatio = 0;
  if (equityCurve.length > 2) {
    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].equity;
      const curr = equityCurve[i].equity;
      if (prev > 0) returns.push((curr - prev) / prev);
    }
    if (returns.length > 1) {
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      // Risk free rate for India assumed ~ 6.5% annually (~ 0.025% per trading day)
      const dailyRf = 0.065 / 252;
      if (stdDev > 0) {
        sharpeRatio = Number((((avgReturn - dailyRf) / stdDev) * Math.sqrt(252)).toFixed(2));
      }
    }
  }

  return {
    initialCapital: initCap,
    endingCapital,
    netPnL,
    returnPercent,
    totalTrades,
    winningTrades,
    losingTrades,
    breakevenTrades,
    winRate,
    profitFactor,
    averageTrade,
    averageWin,
    averageLoss,
    maxDrawdownAmount,
    maxDrawdownPercent,
    expectancy,
    totalCharges: Number(totalCharges.toFixed(2)),
    sharpeRatio,
    equityCurve,
  };
}
