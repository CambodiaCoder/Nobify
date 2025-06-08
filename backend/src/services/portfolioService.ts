import prisma from '../lib/prisma';
import { getPrices, batchUpdatePrices, getHistoricalPrice, EnhancedPriceData } from '../lib/cryptoApi';
import { TransactionType } from '../generated/prisma';

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalPercentageChange: number;
  holdingsCount: number;
}

export interface TimeBasedPerformance {
  period: string;
  startValue: number;
  endValue: number;
  absoluteReturn: number;
  percentageReturn: number;
  startDate: Date;
  endDate: Date;
}

export interface AdvancedPortfolioMetrics {
  sharpeRatio: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  maxDrawdownPeriod: { start: Date; end: Date } | null;
  averageReturn: number;
  winRate: number;
  bestDay: { date: Date; return: number } | null;
  worstDay: { date: Date; return: number } | null;
  totalTradingDays: number;
}

export interface BenchmarkComparison {
  portfolioReturn: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number | null;
  correlation: number | null;
  outperformance: number;
  benchmarkName: string;
}

export interface EnhancedPortfolioMetrics {
  summary: PortfolioSummary;
  timeBasedPerformance: TimeBasedPerformance[];
  advancedMetrics: AdvancedPortfolioMetrics;
  benchmarkComparisons: BenchmarkComparison[];
  riskMetrics: {
    valueAtRisk95: number | null;
    valueAtRisk99: number | null;
    conditionalValueAtRisk: number | null;
    downsideDeviation: number | null;
    sortinoRatio: number | null;
  };
}

export interface HoldingWithMetrics {
  id: string;
  userId: string;
  tokenSymbol: string;
  tokenName: string;
  currentAmount: number;
  averageCostBasis: number | null;
  totalCostBasis: number | null;
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  percentageChange: number | null;
  lastPriceUpdate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Calculate portfolio metrics for a holding based on its transactions
 */
export async function calculateHoldingMetrics(holdingId: string): Promise<void> {
  const holding = await prisma.portfolioHolding.findUnique({
    where: { id: holdingId },
    include: { transactions: true }
  });

  if (!holding) {
    throw new Error('Holding not found');
  }

  let totalCostBasis = 0;
  let totalAmount = 0;
  let realizedPnL = 0;

  // Calculate metrics from transactions
  for (const transaction of holding.transactions) {
    const amount = transaction.amount;
    const price = transaction.pricePerToken || 0;
    const value = transaction.totalValue || (amount * price);

    switch (transaction.type) {
      case TransactionType.BUY:
      case TransactionType.TRANSFER_IN:
      case TransactionType.AIRDROP:
      case TransactionType.REWARD:
        totalAmount += amount;
        totalCostBasis += value;
        break;

      case TransactionType.SELL:
      case TransactionType.TRANSFER_OUT:
        totalAmount -= amount;
        // Calculate realized P&L for sells
        if (transaction.type === TransactionType.SELL && totalCostBasis > 0) {
          const avgCostBasis = totalCostBasis / (totalAmount + amount); // Amount before this transaction
          const costOfSold = avgCostBasis * amount;
          realizedPnL += (value - costOfSold);
          totalCostBasis -= costOfSold;
        }
        break;

      case TransactionType.STAKE:
      case TransactionType.UNSTAKE:
        // For staking, we don't change the cost basis, just track the amount
        if (transaction.type === TransactionType.STAKE) {
          // Amount is locked but still owned
        } else {
          // Amount is unlocked
        }
        break;
    }
  }

  const averageCostBasis = totalAmount > 0 ? totalCostBasis / totalAmount : null;

  // Update the holding with calculated metrics
  await prisma.portfolioHolding.update({
    where: { id: holdingId },
    data: {
      currentAmount: totalAmount,
      averageCostBasis,
      totalCostBasis,
      realizedPnL,
      updatedAt: new Date()
    }
  });
}

/**
 * Update current prices and calculate unrealized P&L for holdings
 */
export async function updateHoldingPrices(userId: string, useRetry: boolean = true): Promise<{
  updated: number;
  failed: number;
  errors: string[];
}> {
  const holdings = await prisma.portfolioHolding.findMany({
    where: { userId }
  });

  if (holdings.length === 0) {
    return { updated: 0, failed: 0, errors: [] };
  }

  const tokenSymbols = holdings.map(h => h.tokenSymbol);
  const errors: string[] = [];
  let updated = 0;
  let failed = 0;

  try {
    // Use batch update with retry logic for better reliability
    const prices = useRetry
      ? await batchUpdatePrices(tokenSymbols, 3)
      : await getPrices(tokenSymbols);

    // Update each holding with current price and calculated values
    for (const holding of holdings) {
      try {
        const priceData = prices[holding.tokenSymbol.toLowerCase()];

        if (!priceData) {
          errors.push(`No price data found for ${holding.tokenSymbol}`);
          failed++;
          continue;
        }

        const currentPrice = priceData.usd;
        let currentValue = null;
        let unrealizedPnL = null;
        let percentageChange = null;

        if (currentPrice > 0 && holding.currentAmount > 0) {
          currentValue = holding.currentAmount * currentPrice;

          if (holding.totalCostBasis && holding.totalCostBasis > 0) {
            unrealizedPnL = currentValue - holding.totalCostBasis;
            percentageChange = (unrealizedPnL / holding.totalCostBasis) * 100;
          }
        }

        await prisma.portfolioHolding.update({
          where: { id: holding.id },
          data: {
            currentPrice: currentPrice > 0 ? currentPrice : null,
            currentValue,
            unrealizedPnL,
            percentageChange,
            lastPriceUpdate: new Date(),
            updatedAt: new Date()
          }
        });

        updated++;
      } catch (error) {
        const errorMsg = `Failed to update ${holding.tokenSymbol}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
        failed++;
      }
    }
  } catch (error) {
    const errorMsg = `Failed to fetch prices: ${error}`;
    errors.push(errorMsg);
    console.error(errorMsg);
    failed = holdings.length;
  }

  return { updated, failed, errors };
}

/**
 * Get portfolio summary with aggregated metrics
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary & {
  priceUpdateStats?: { updated: number; failed: number; errors: string[] };
}> {
  // First update prices and get update statistics
  const priceUpdateStats = await updateHoldingPrices(userId);

  const holdings = await prisma.portfolioHolding.findMany({
    where: { userId }
  });

  let totalValue = 0;
  let totalCostBasis = 0;
  let totalUnrealizedPnL = 0;
  let totalRealizedPnL = 0;

  for (const holding of holdings) {
    totalValue += holding.currentValue || 0;
    totalCostBasis += holding.totalCostBasis || 0;
    totalUnrealizedPnL += holding.unrealizedPnL || 0;
    totalRealizedPnL += holding.realizedPnL || 0;
  }

  const totalPercentageChange = totalCostBasis > 0
    ? (totalUnrealizedPnL / totalCostBasis) * 100
    : 0;

  return {
    totalValue,
    totalCostBasis,
    totalUnrealizedPnL,
    totalRealizedPnL,
    totalPercentageChange,
    holdingsCount: holdings.length,
    priceUpdateStats
  };
}

/**
 * Get holdings with updated metrics
 */
export async function getHoldingsWithMetrics(userId: string): Promise<HoldingWithMetrics[]> {
  // Update prices first
  await updateHoldingPrices(userId);

  const holdings = await prisma.portfolioHolding.findMany({
    where: { userId },
    orderBy: [
      { currentValue: 'desc' },
      { tokenSymbol: 'asc' }
    ]
  });

  return holdings;
}

/**
 * Add a new transaction and recalculate holding metrics
 */
export async function addTransaction(
  holdingId: string,
  transactionData: {
    type: TransactionType;
    amount: number;
    pricePerToken?: number;
    totalValue?: number;
    transactionFee?: number;
    feeTokenSymbol?: string;
    exchangeName?: string;
    transactionHash?: string;
    date: Date;
    notes?: string;
  }
): Promise<void> {
  // Create the transaction
  await prisma.transaction.create({
    data: {
      holdingId,
      ...transactionData,
      updatedAt: new Date()
    }
  });

  // Recalculate holding metrics
  await calculateHoldingMetrics(holdingId);
}

/**
 * Enhanced transaction creation with historical price lookup
 */
export async function addTransactionWithPriceLookup(
  holdingId: string,
  transactionData: {
    type: TransactionType;
    amount: number;
    pricePerToken?: number;
    totalValue?: number;
    transactionFee?: number;
    feeTokenSymbol?: string;
    exchangeName?: string;
    transactionHash?: string;
    date: Date;
    notes?: string;
  }
): Promise<{ success: boolean; historicalPrice?: number; message: string }> {
  try {
    // Get holding info for price lookup
    const holding = await prisma.portfolioHolding.findUnique({
      where: { id: holdingId }
    });

    if (!holding) {
      return { success: false, message: 'Holding not found' };
    }

    let finalTransactionData = { ...transactionData };

    // If no price provided, try to fetch historical price
    if (!transactionData.pricePerToken && !transactionData.totalValue) {
      console.log(`Attempting to fetch historical price for ${holding.tokenSymbol} on ${transactionData.date}`);

      const historicalPrice = await getHistoricalPrice(holding.tokenSymbol, transactionData.date);

      if (historicalPrice) {
        finalTransactionData.pricePerToken = historicalPrice;
        finalTransactionData.totalValue = historicalPrice * transactionData.amount;

        await addTransaction(holdingId, finalTransactionData);

        return {
          success: true,
          historicalPrice,
          message: `Transaction added with historical price: $${historicalPrice.toFixed(2)}`
        };
      } else {
        // Still create transaction without price data
        await addTransaction(holdingId, finalTransactionData);

        return {
          success: true,
          message: 'Transaction added without price data (historical price not available)'
        };
      }
    } else {
      // Create transaction with provided price data
      await addTransaction(holdingId, finalTransactionData);

      return {
        success: true,
        message: 'Transaction added successfully'
      };
    }
  } catch (error) {
    console.error('Error adding transaction with price lookup:', error);
    return {
      success: false,
      message: `Failed to add transaction: ${error}`
    };
  }
}

/**
 * Bulk price update for all users (useful for scheduled tasks)
 */
export async function bulkUpdateAllUserPrices(): Promise<{
  usersProcessed: number;
  totalHoldingsUpdated: number;
  totalErrors: number;
  processingTime: number;
}> {
  const startTime = Date.now();
  let usersProcessed = 0;
  let totalHoldingsUpdated = 0;
  let totalErrors = 0;

  try {
    // Get all users with holdings
    const usersWithHoldings = await prisma.user.findMany({
      where: {
        holdings: {
          some: {}
        }
      },
      select: { id: true }
    });

    console.log(`Starting bulk price update for ${usersWithHoldings.length} users`);

    for (const user of usersWithHoldings) {
      try {
        const result = await updateHoldingPrices(user.id, true);
        totalHoldingsUpdated += result.updated;
        totalErrors += result.failed;
        usersProcessed++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to update prices for user ${user.id}:`, error);
        totalErrors++;
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`Bulk price update completed: ${usersProcessed} users, ${totalHoldingsUpdated} holdings updated, ${totalErrors} errors, ${processingTime}ms`);

    return {
      usersProcessed,
      totalHoldingsUpdated,
      totalErrors,
      processingTime
    };
  } catch (error) {
    console.error('Error in bulk price update:', error);
    return {
      usersProcessed,
      totalHoldingsUpdated,
      totalErrors: totalErrors + 1,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Get portfolio performance analytics
 */
export async function getPortfolioAnalytics(userId: string): Promise<{
  summary: PortfolioSummary;
  topPerformers: Array<{ symbol: string; percentageChange: number; value: number }>;
  worstPerformers: Array<{ symbol: string; percentageChange: number; value: number }>;
  allocationByValue: Array<{ symbol: string; percentage: number; value: number }>;
  recentActivity: Array<{ type: string; symbol: string; amount: number; date: Date }>;
}> {
  // Get updated portfolio summary
  const summary = await getPortfolioSummary(userId);

  // Get holdings with performance data
  const holdings = await getHoldingsWithMetrics(userId);

  // Get recent transactions
  const recentTransactions = await prisma.transaction.findMany({
    where: {
      holding: { userId }
    },
    include: {
      holding: {
        select: { tokenSymbol: true }
      }
    },
    orderBy: { date: 'desc' },
    take: 10
  });

  // Calculate top and worst performers
  const holdingsWithPerformance = holdings
    .filter(h => h.percentageChange !== null && h.currentValue && h.currentValue > 0)
    .map(h => ({
      symbol: h.tokenSymbol,
      percentageChange: h.percentageChange!,
      value: h.currentValue!
    }));

  const topPerformers = holdingsWithPerformance
    .sort((a, b) => b.percentageChange - a.percentageChange)
    .slice(0, 5);

  const worstPerformers = holdingsWithPerformance
    .sort((a, b) => a.percentageChange - b.percentageChange)
    .slice(0, 5);

  // Calculate allocation by value
  const totalPortfolioValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  const allocationByValue = holdings
    .filter(h => h.currentValue && h.currentValue > 0)
    .map(h => ({
      symbol: h.tokenSymbol,
      value: h.currentValue!,
      percentage: totalPortfolioValue > 0 ? (h.currentValue! / totalPortfolioValue) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);

  // Format recent activity
  const recentActivity = recentTransactions.map(t => ({
    type: t.type,
    symbol: t.holding.tokenSymbol,
    amount: t.amount,
    date: t.date
  }));

  return {
    summary,
    topPerformers,
    worstPerformers,
    allocationByValue,
    recentActivity
  };
}

/**
 * Calculate time-based performance metrics for different periods
 */
export async function calculateTimeBasedPerformance(userId: string): Promise<TimeBasedPerformance[]> {
  const now = new Date();
  const periods = [
    { name: '1D', days: 1 },
    { name: '7D', days: 7 },
    { name: '30D', days: 30 },
    { name: '90D', days: 90 },
    { name: '1Y', days: 365 },
    { name: 'YTD', days: Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)) }
  ];

  const results: TimeBasedPerformance[] = [];

  for (const period of periods) {
    const startDate = new Date(now.getTime() - (period.days * 24 * 60 * 60 * 1000));

    // Get portfolio value at start of period (estimated from transactions)
    const startValue = await estimatePortfolioValueAtDate(userId, startDate);

    // Get current portfolio value
    const currentSummary = await getPortfolioSummary(userId);
    const endValue = currentSummary.totalValue;

    const absoluteReturn = endValue - startValue;
    const percentageReturn = startValue > 0 ? (absoluteReturn / startValue) * 100 : 0;

    results.push({
      period: period.name,
      startValue,
      endValue,
      absoluteReturn,
      percentageReturn,
      startDate,
      endDate: now
    });
  }

  return results;
}

/**
 * Estimate portfolio value at a specific date based on transaction history
 */
async function estimatePortfolioValueAtDate(userId: string, targetDate: Date): Promise<number> {
  // Get all transactions up to the target date
  const transactions = await prisma.transaction.findMany({
    where: {
      holding: { userId },
      date: { lte: targetDate }
    },
    include: {
      holding: true
    },
    orderBy: { date: 'asc' }
  });

  // Calculate holdings at that date
  const holdingsAtDate: { [symbol: string]: { amount: number; costBasis: number } } = {};

  for (const transaction of transactions) {
    const symbol = transaction.holding.tokenSymbol;

    if (!holdingsAtDate[symbol]) {
      holdingsAtDate[symbol] = { amount: 0, costBasis: 0 };
    }

    const amount = transaction.amount;
    const value = transaction.totalValue || (transaction.pricePerToken || 0) * amount;

    switch (transaction.type) {
      case TransactionType.BUY:
      case TransactionType.TRANSFER_IN:
      case TransactionType.AIRDROP:
      case TransactionType.REWARD:
        holdingsAtDate[symbol].amount += amount;
        holdingsAtDate[symbol].costBasis += value;
        break;
      case TransactionType.SELL:
      case TransactionType.TRANSFER_OUT:
        holdingsAtDate[symbol].amount -= amount;
        // Proportionally reduce cost basis
        if (holdingsAtDate[symbol].amount > 0) {
          const ratio = amount / (holdingsAtDate[symbol].amount + amount);
          holdingsAtDate[symbol].costBasis *= (1 - ratio);
        }
        break;
    }
  }

  // Get historical prices for the target date and calculate value
  let totalValue = 0;

  for (const [symbol, holding] of Object.entries(holdingsAtDate)) {
    if (holding.amount > 0) {
      try {
        const historicalPrice = await getHistoricalPrice(symbol, targetDate);
        if (historicalPrice) {
          totalValue += holding.amount * historicalPrice;
        } else {
          // Fallback to cost basis if no historical price available
          totalValue += holding.costBasis;
        }
      } catch (error) {
        console.warn(`Failed to get historical price for ${symbol} at ${targetDate}:`, error);
        totalValue += holding.costBasis;
      }
    }
  }

  return totalValue;
}

/**
 * Calculate advanced portfolio metrics including Sharpe ratio, volatility, etc.
 */
export async function calculateAdvancedMetrics(userId: string): Promise<AdvancedPortfolioMetrics> {
  // Get daily portfolio values for the last year
  const dailyReturns = await calculateDailyReturns(userId, 365);

  if (dailyReturns.length === 0) {
    return {
      sharpeRatio: null,
      volatility: null,
      maxDrawdown: null,
      maxDrawdownPeriod: null,
      averageReturn: 0,
      winRate: 0,
      bestDay: null,
      worstDay: null,
      totalTradingDays: 0
    };
  }

  // Calculate basic statistics
  const returns = dailyReturns.map(d => d.return);
  const averageReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - averageReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(365); // Annualized volatility

  // Calculate Sharpe ratio (assuming 0% risk-free rate for crypto)
  const sharpeRatio = volatility > 0 ? (averageReturn * 365) / volatility : null;

  // Calculate max drawdown
  const { maxDrawdown, maxDrawdownPeriod } = calculateMaxDrawdown(dailyReturns);

  // Calculate win rate
  const winningDays = returns.filter(r => r > 0).length;
  const winRate = (winningDays / returns.length) * 100;

  // Find best and worst days
  const bestDayIndex = returns.indexOf(Math.max(...returns));
  const worstDayIndex = returns.indexOf(Math.min(...returns));

  const bestDay = bestDayIndex >= 0 ? {
    date: dailyReturns[bestDayIndex].date,
    return: returns[bestDayIndex]
  } : null;

  const worstDay = worstDayIndex >= 0 ? {
    date: dailyReturns[worstDayIndex].date,
    return: returns[worstDayIndex]
  } : null;

  return {
    sharpeRatio,
    volatility,
    maxDrawdown,
    maxDrawdownPeriod,
    averageReturn: averageReturn * 365, // Annualized
    winRate,
    bestDay,
    worstDay,
    totalTradingDays: returns.length
  };
}

/**
 * Calculate daily returns for portfolio over a specified period
 */
async function calculateDailyReturns(userId: string, days: number): Promise<Array<{ date: Date; value: number; return: number }>> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

  const dailyValues: Array<{ date: Date; value: number; return: number }> = [];
  let previousValue: number | null = null;

  // Calculate portfolio value for each day
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));

    try {
      const portfolioValue = await estimatePortfolioValueAtDate(userId, currentDate);

      const dailyReturn = previousValue !== null && previousValue > 0
        ? ((portfolioValue - previousValue) / previousValue) * 100
        : 0;

      dailyValues.push({
        date: currentDate,
        value: portfolioValue,
        return: dailyReturn
      });

      previousValue = portfolioValue;
    } catch (error) {
      console.warn(`Failed to calculate portfolio value for ${currentDate}:`, error);
    }
  }

  return dailyValues;
}

/**
 * Calculate maximum drawdown and its period
 */
function calculateMaxDrawdown(dailyReturns: Array<{ date: Date; value: number; return: number }>): {
  maxDrawdown: number | null;
  maxDrawdownPeriod: { start: Date; end: Date } | null;
} {
  if (dailyReturns.length === 0) {
    return { maxDrawdown: null, maxDrawdownPeriod: null };
  }

  let maxDrawdown = 0;
  let maxDrawdownPeriod: { start: Date; end: Date } | null = null;
  let peak = dailyReturns[0].value;
  let peakDate = dailyReturns[0].date;

  for (const day of dailyReturns) {
    if (day.value > peak) {
      peak = day.value;
      peakDate = day.date;
    }

    const drawdown = peak > 0 ? ((peak - day.value) / peak) * 100 : 0;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPeriod = { start: peakDate, end: day.date };
    }
  }

  return {
    maxDrawdown: maxDrawdown > 0 ? maxDrawdown : null,
    maxDrawdownPeriod
  };
}

/**
 * Calculate risk metrics including VaR and Sortino ratio
 */
export async function calculateRiskMetrics(userId: string): Promise<{
  valueAtRisk95: number | null;
  valueAtRisk99: number | null;
  conditionalValueAtRisk: number | null;
  downsideDeviation: number | null;
  sortinoRatio: number | null;
}> {
  const dailyReturns = await calculateDailyReturns(userId, 365);

  if (dailyReturns.length === 0) {
    return {
      valueAtRisk95: null,
      valueAtRisk99: null,
      conditionalValueAtRisk: null,
      downsideDeviation: null,
      sortinoRatio: null
    };
  }

  const returns = dailyReturns.map(d => d.return).sort((a, b) => a - b);
  const averageReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate Value at Risk (VaR)
  const var95Index = Math.floor(returns.length * 0.05);
  const var99Index = Math.floor(returns.length * 0.01);

  const valueAtRisk95 = returns[var95Index] || null;
  const valueAtRisk99 = returns[var99Index] || null;

  // Calculate Conditional Value at Risk (CVaR) - average of worst 5% returns
  const worstReturns = returns.slice(0, var95Index + 1);
  const conditionalValueAtRisk = worstReturns.length > 0
    ? worstReturns.reduce((sum, r) => sum + r, 0) / worstReturns.length
    : null;

  // Calculate downside deviation (only negative returns)
  const negativeReturns = returns.filter(r => r < 0);
  const downsideDeviation = negativeReturns.length > 0
    ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
    : null;

  // Calculate Sortino ratio
  const sortinoRatio = downsideDeviation && downsideDeviation > 0
    ? (averageReturn * 365) / (downsideDeviation * Math.sqrt(365))
    : null;

  return {
    valueAtRisk95,
    valueAtRisk99,
    conditionalValueAtRisk,
    downsideDeviation,
    sortinoRatio
  };
}

/**
 * Calculate benchmark comparisons (vs BTC, ETH, etc.)
 */
export async function calculateBenchmarkComparisons(userId: string): Promise<BenchmarkComparison[]> {
  const benchmarks = ['BTC', 'ETH'];
  const comparisons: BenchmarkComparison[] = [];

  // Get portfolio performance for the last year
  const portfolioReturns = await calculateDailyReturns(userId, 365);

  if (portfolioReturns.length === 0) {
    return comparisons;
  }

  const portfolioReturn = portfolioReturns.length > 0
    ? ((portfolioReturns[portfolioReturns.length - 1].value - portfolioReturns[0].value) / portfolioReturns[0].value) * 100
    : 0;

  for (const benchmark of benchmarks) {
    try {
      // Calculate benchmark return for the same period
      const startDate = portfolioReturns[0].date;
      const endDate = portfolioReturns[portfolioReturns.length - 1].date;

      const startPrice = await getHistoricalPrice(benchmark, startDate);
      const endPrice = await getHistoricalPrice(benchmark, endDate);

      if (startPrice && endPrice && startPrice > 0) {
        const benchmarkReturn = ((endPrice - startPrice) / startPrice) * 100;
        const outperformance = portfolioReturn - benchmarkReturn;

        // Calculate correlation and beta (simplified)
        const { correlation, beta } = calculateCorrelationAndBeta(portfolioReturns, benchmark);

        const alpha = portfolioReturn - (benchmarkReturn * (beta || 1));

        comparisons.push({
          portfolioReturn,
          benchmarkReturn,
          alpha,
          beta,
          correlation,
          outperformance,
          benchmarkName: benchmark
        });
      }
    } catch (error) {
      console.warn(`Failed to calculate benchmark comparison for ${benchmark}:`, error);
    }
  }

  return comparisons;
}

/**
 * Calculate correlation and beta between portfolio and benchmark (simplified)
 */
function calculateCorrelationAndBeta(portfolioReturns: Array<{ date: Date; value: number; return: number }>, benchmark: string): {
  correlation: number | null;
  beta: number | null;
} {
  // This is a simplified implementation
  // In a real-world scenario, you'd need daily benchmark prices to calculate proper correlation and beta
  return {
    correlation: null, // Would need benchmark daily returns
    beta: null // Would need benchmark daily returns
  };
}

// Transaction History Enhancement Interfaces
export interface TransactionFilter {
  userId: string;
  holdingId?: string;
  type?: TransactionType | TransactionType[];
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  exchangeName?: string;
  search?: string; // Search in notes, transaction hash, etc.
}

export interface TransactionPagination {
  page: number;
  limit: number;
  sortBy?: 'date' | 'amount' | 'totalValue' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionAnalytics {
  totalTransactions: number;
  transactionsByType: { [key in TransactionType]: number };
  totalVolume: number;
  averageTransactionSize: number;
  mostActiveExchange: string | null;
  transactionFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}

export interface BulkTransactionResult {
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: any }>;
  transactions: string[]; // IDs of created transactions
}

/**
 * Get comprehensive enhanced portfolio metrics
 */
export async function getEnhancedPortfolioMetrics(userId: string): Promise<EnhancedPortfolioMetrics> {
  try {
    // Run all calculations in parallel for better performance
    const [
      summary,
      timeBasedPerformance,
      advancedMetrics,
      riskMetrics,
      benchmarkComparisons
    ] = await Promise.all([
      getPortfolioSummary(userId),
      calculateTimeBasedPerformance(userId),
      calculateAdvancedMetrics(userId),
      calculateRiskMetrics(userId),
      calculateBenchmarkComparisons(userId)
    ]);

    return {
      summary,
      timeBasedPerformance,
      advancedMetrics,
      benchmarkComparisons,
      riskMetrics
    };
  } catch (error) {
    console.error('Error calculating enhanced portfolio metrics:', error);

    // Return fallback data if calculations fail
    const summary = await getPortfolioSummary(userId);

    return {
      summary,
      timeBasedPerformance: [],
      advancedMetrics: {
        sharpeRatio: null,
        volatility: null,
        maxDrawdown: null,
        maxDrawdownPeriod: null,
        averageReturn: 0,
        winRate: 0,
        bestDay: null,
        worstDay: null,
        totalTradingDays: 0
      },
      benchmarkComparisons: [],
      riskMetrics: {
        valueAtRisk95: null,
        valueAtRisk99: null,
        conditionalValueAtRisk: null,
        downsideDeviation: null,
        sortinoRatio: null
      }
    };
  }
}

/**
 * Get filtered and paginated transaction history
 */
export async function getTransactionHistory(
  filter: TransactionFilter,
  pagination: TransactionPagination
): Promise<{
  transactions: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}> {
  const { page, limit, sortBy = 'date', sortOrder = 'desc' } = pagination;
  const offset = (page - 1) * limit;

  // Build where clause
  const whereClause: any = {
    holding: { userId: filter.userId }
  };

  if (filter.holdingId) {
    whereClause.holdingId = filter.holdingId;
  }

  if (filter.type) {
    if (Array.isArray(filter.type)) {
      whereClause.type = { in: filter.type };
    } else {
      whereClause.type = filter.type;
    }
  }

  if (filter.dateFrom || filter.dateTo) {
    whereClause.date = {};
    if (filter.dateFrom) {
      whereClause.date.gte = filter.dateFrom;
    }
    if (filter.dateTo) {
      whereClause.date.lte = filter.dateTo;
    }
  }

  if (filter.amountMin !== undefined || filter.amountMax !== undefined) {
    whereClause.amount = {};
    if (filter.amountMin !== undefined) {
      whereClause.amount.gte = filter.amountMin;
    }
    if (filter.amountMax !== undefined) {
      whereClause.amount.lte = filter.amountMax;
    }
  }

  if (filter.exchangeName) {
    whereClause.exchangeName = {
      contains: filter.exchangeName,
      mode: 'insensitive'
    };
  }

  if (filter.search) {
    whereClause.OR = [
      { notes: { contains: filter.search, mode: 'insensitive' } },
      { transactionHash: { contains: filter.search, mode: 'insensitive' } },
      { exchangeName: { contains: filter.search, mode: 'insensitive' } }
    ];
  }

  // Get total count
  const totalCount = await prisma.transaction.count({ where: whereClause });

  // Get transactions
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      holding: {
        select: {
          tokenSymbol: true,
          tokenName: true
        }
      }
    },
    orderBy: { [sortBy]: sortOrder },
    skip: offset,
    take: limit
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    transactions,
    totalCount,
    totalPages,
    currentPage: page
  };
}

/**
 * Get transaction analytics for a user
 */
export async function getTransactionAnalytics(userId: string, dateFrom?: Date, dateTo?: Date): Promise<TransactionAnalytics> {
  const whereClause: any = {
    holding: { userId }
  };

  if (dateFrom || dateTo) {
    whereClause.date = {};
    if (dateFrom) whereClause.date.gte = dateFrom;
    if (dateTo) whereClause.date.lte = dateTo;
  }

  // Get all transactions for analytics
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      holding: {
        select: { tokenSymbol: true }
      }
    },
    orderBy: { date: 'asc' }
  });

  if (transactions.length === 0) {
    return {
      totalTransactions: 0,
      transactionsByType: {
        BUY: 0,
        SELL: 0,
        TRANSFER_IN: 0,
        TRANSFER_OUT: 0,
        STAKE: 0,
        UNSTAKE: 0,
        REWARD: 0,
        AIRDROP: 0
      },
      totalVolume: 0,
      averageTransactionSize: 0,
      mostActiveExchange: null,
      transactionFrequency: { daily: 0, weekly: 0, monthly: 0 },
      dateRange: { earliest: null, latest: null }
    };
  }

  // Calculate analytics
  const transactionsByType = transactions.reduce((acc, tx) => {
    acc[tx.type] = (acc[tx.type] || 0) + 1;
    return acc;
  }, {} as { [key in TransactionType]: number });

  // Ensure all transaction types are present
  Object.values(TransactionType).forEach(type => {
    if (!transactionsByType[type]) {
      transactionsByType[type] = 0;
    }
  });

  const totalVolume = transactions.reduce((sum, tx) => sum + (tx.totalValue || 0), 0);
  const averageTransactionSize = totalVolume / transactions.length;

  // Find most active exchange
  const exchangeCounts = transactions.reduce((acc, tx) => {
    if (tx.exchangeName) {
      acc[tx.exchangeName] = (acc[tx.exchangeName] || 0) + 1;
    }
    return acc;
  }, {} as { [key: string]: number });

  const mostActiveExchange = Object.keys(exchangeCounts).length > 0
    ? Object.keys(exchangeCounts).reduce((a, b) => exchangeCounts[a] > exchangeCounts[b] ? a : b)
    : null;

  // Calculate frequency
  const dateRange = {
    earliest: transactions[0]?.date || null,
    latest: transactions[transactions.length - 1]?.date || null
  };

  let transactionFrequency = { daily: 0, weekly: 0, monthly: 0 };

  if (dateRange.earliest && dateRange.latest) {
    const daysDiff = Math.max(1, Math.ceil((dateRange.latest.getTime() - dateRange.earliest.getTime()) / (1000 * 60 * 60 * 24)));
    const weeksDiff = Math.max(1, Math.ceil(daysDiff / 7));
    const monthsDiff = Math.max(1, Math.ceil(daysDiff / 30));

    transactionFrequency = {
      daily: transactions.length / daysDiff,
      weekly: transactions.length / weeksDiff,
      monthly: transactions.length / monthsDiff
    };
  }

  return {
    totalTransactions: transactions.length,
    transactionsByType,
    totalVolume,
    averageTransactionSize,
    mostActiveExchange,
    transactionFrequency,
    dateRange
  };
}

/**
 * Validate transaction data
 */
export function validateTransactionData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!data.holdingId) errors.push('holdingId is required');
  if (!data.type) errors.push('type is required');
  if (data.amount === undefined || data.amount === null) errors.push('amount is required');
  if (!data.date) errors.push('date is required');

  // Type validation
  if (data.type && !Object.values(TransactionType).includes(data.type)) {
    errors.push(`Invalid transaction type: ${data.type}`);
  }

  // Amount validation
  if (data.amount !== undefined && (typeof data.amount !== 'number' || data.amount < 0)) {
    errors.push('amount must be a non-negative number');
  }

  // Price validation
  if (data.pricePerToken !== undefined && (typeof data.pricePerToken !== 'number' || data.pricePerToken < 0)) {
    errors.push('pricePerToken must be a non-negative number');
  }

  // Date validation
  if (data.date) {
    const date = new Date(data.date);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format');
    } else if (date > new Date()) {
      errors.push('Transaction date cannot be in the future');
    }
  }

  // String length validations
  if (data.notes && data.notes.length > 500) {
    errors.push('notes cannot exceed 500 characters');
  }
  if (data.exchangeName && data.exchangeName.length > 50) {
    errors.push('exchangeName cannot exceed 50 characters');
  }
  if (data.transactionHash && data.transactionHash.length > 100) {
    errors.push('transactionHash cannot exceed 100 characters');
  }
  if (data.feeTokenSymbol && data.feeTokenSymbol.length > 10) {
    errors.push('feeTokenSymbol cannot exceed 10 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Bulk import transactions from CSV data
 */
export async function bulkImportTransactions(
  userId: string,
  transactionsData: any[]
): Promise<BulkTransactionResult> {
  const result: BulkTransactionResult = {
    successful: 0,
    failed: 0,
    errors: [],
    transactions: []
  };

  // Get user's holdings for validation
  const userHoldings = await prisma.portfolioHolding.findMany({
    where: { userId },
    select: { id: true, tokenSymbol: true }
  });

  const holdingsBySymbol = userHoldings.reduce((acc, holding) => {
    acc[holding.tokenSymbol.toLowerCase()] = holding.id;
    return acc;
  }, {} as { [symbol: string]: string });

  for (let i = 0; i < transactionsData.length; i++) {
    const rowData = transactionsData[i];

    try {
      // Validate transaction data
      const validation = validateTransactionData(rowData);
      if (!validation.isValid) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          error: validation.errors.join(', '),
          data: rowData
        });
        continue;
      }

      // If holdingId is not provided but tokenSymbol is, try to find the holding
      let holdingId = rowData.holdingId;
      if (!holdingId && rowData.tokenSymbol) {
        holdingId = holdingsBySymbol[rowData.tokenSymbol.toLowerCase()];
        if (!holdingId) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: `No holding found for token symbol: ${rowData.tokenSymbol}`,
            data: rowData
          });
          continue;
        }
      }

      // Verify holding belongs to user
      const holding = await prisma.portfolioHolding.findFirst({
        where: { id: holdingId, userId }
      });

      if (!holding) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          error: 'Holding not found or does not belong to user',
          data: rowData
        });
        continue;
      }

      // Calculate totalValue if not provided
      const totalValue = rowData.totalValue ||
        (rowData.pricePerToken && rowData.amount ? rowData.pricePerToken * rowData.amount : undefined);

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          holdingId,
          type: rowData.type,
          amount: rowData.amount,
          pricePerToken: rowData.pricePerToken || null,
          totalValue: totalValue || null,
          transactionFee: rowData.transactionFee || null,
          feeTokenSymbol: rowData.feeTokenSymbol || null,
          exchangeName: rowData.exchangeName || null,
          transactionHash: rowData.transactionHash || null,
          date: new Date(rowData.date),
          notes: rowData.notes || null,
          updatedAt: new Date()
        }
      });

      result.successful++;
      result.transactions.push(transaction.id);

      // Recalculate holding metrics (do this in batches for performance)
      if (result.successful % 10 === 0) {
        await calculateHoldingMetrics(holdingId);
      }

    } catch (error) {
      result.failed++;
      result.errors.push({
        row: i + 1,
        error: `Database error: ${error}`,
        data: rowData
      });
    }
  }

  // Recalculate metrics for all affected holdings
  const affectedHoldings = new Set<string>();
  for (const transactionId of result.transactions) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { holdingId: true }
    });
    if (transaction) {
      affectedHoldings.add(transaction.holdingId);
    }
  }

  // Recalculate metrics for all affected holdings
  for (const holdingId of affectedHoldings) {
    try {
      await calculateHoldingMetrics(holdingId);
    } catch (error) {
      console.error(`Failed to recalculate metrics for holding ${holdingId}:`, error);
    }
  }

  return result;
}

/**
 * Export transactions to CSV format
 */
export async function exportTransactionsToCSV(userId: string, filter?: Partial<TransactionFilter>): Promise<string> {
  const transactions = await prisma.transaction.findMany({
    where: {
      holding: { userId },
      ...(filter?.holdingId && { holdingId: filter.holdingId }),
      ...(filter?.type && { type: Array.isArray(filter.type) ? { in: filter.type } : filter.type }),
      ...(filter?.dateFrom || filter?.dateTo ? {
        date: {
          ...(filter.dateFrom && { gte: filter.dateFrom }),
          ...(filter.dateTo && { lte: filter.dateTo })
        }
      } : {})
    },
    include: {
      holding: {
        select: {
          tokenSymbol: true,
          tokenName: true
        }
      }
    },
    orderBy: { date: 'desc' }
  });

  // CSV headers
  const headers = [
    'Date',
    'Token Symbol',
    'Token Name',
    'Type',
    'Amount',
    'Price Per Token',
    'Total Value',
    'Transaction Fee',
    'Fee Token Symbol',
    'Exchange Name',
    'Transaction Hash',
    'Notes'
  ];

  // Convert transactions to CSV rows
  const rows = transactions.map(tx => [
    tx.date.toISOString(),
    tx.holding.tokenSymbol,
    tx.holding.tokenName,
    tx.type,
    tx.amount.toString(),
    tx.pricePerToken?.toString() || '',
    tx.totalValue?.toString() || '',
    tx.transactionFee?.toString() || '',
    tx.feeTokenSymbol || '',
    tx.exchangeName || '',
    tx.transactionHash || '',
    tx.notes || ''
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Update transaction with validation
 */
export async function updateTransaction(
  transactionId: string,
  userId: string,
  updateData: Partial<{
    type: TransactionType;
    amount: number;
    pricePerToken: number;
    totalValue: number;
    transactionFee: number;
    feeTokenSymbol: string;
    exchangeName: string;
    transactionHash: string;
    date: Date;
    notes: string;
  }>
): Promise<{ success: boolean; message: string; transaction?: any }> {
  try {
    // Verify transaction belongs to user
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        holding: { userId }
      },
      include: { holding: true }
    });

    if (!existingTransaction) {
      return { success: false, message: 'Transaction not found' };
    }

    // Validate update data
    const validation = validateTransactionData({ ...existingTransaction, ...updateData });
    if (!validation.isValid) {
      return { success: false, message: validation.errors.join(', ') };
    }

    // Calculate totalValue if amount or pricePerToken changed
    let finalUpdateData = { ...updateData };
    if (updateData.amount !== undefined || updateData.pricePerToken !== undefined) {
      const newAmount = updateData.amount ?? existingTransaction.amount;
      const newPrice = updateData.pricePerToken ?? existingTransaction.pricePerToken;

      if (newAmount && newPrice) {
        finalUpdateData.totalValue = newAmount * newPrice;
      }
    }

    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        ...finalUpdateData,
        updatedAt: new Date()
      },
      include: {
        holding: {
          select: {
            tokenSymbol: true,
            tokenName: true
          }
        }
      }
    });

    // Recalculate holding metrics
    await calculateHoldingMetrics(existingTransaction.holdingId);

    return {
      success: true,
      message: 'Transaction updated successfully',
      transaction: updatedTransaction
    };

  } catch (error) {
    console.error('Error updating transaction:', error);
    return { success: false, message: `Failed to update transaction: ${error}` };
  }
}

/**
 * Get transaction statistics for dashboard
 */
export async function getTransactionStats(userId: string): Promise<{
  totalTransactions: number;
  thisMonth: number;
  thisWeek: number;
  recentTransactions: any[];
  topExchanges: Array<{ name: string; count: number }>;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

  const [totalTransactions, thisMonth, thisWeek, recentTransactions, allTransactions] = await Promise.all([
    // Total transactions
    prisma.transaction.count({
      where: { holding: { userId } }
    }),

    // This month
    prisma.transaction.count({
      where: {
        holding: { userId },
        date: { gte: startOfMonth }
      }
    }),

    // This week
    prisma.transaction.count({
      where: {
        holding: { userId },
        date: { gte: startOfWeek }
      }
    }),

    // Recent transactions
    prisma.transaction.findMany({
      where: { holding: { userId } },
      include: {
        holding: {
          select: { tokenSymbol: true, tokenName: true }
        }
      },
      orderBy: { date: 'desc' },
      take: 5
    }),

    // All transactions for exchange analysis
    prisma.transaction.findMany({
      where: { holding: { userId } },
      select: { exchangeName: true }
    })
  ]);

  // Calculate top exchanges
  const exchangeCounts = allTransactions.reduce((acc, tx) => {
    if (tx.exchangeName) {
      acc[tx.exchangeName] = (acc[tx.exchangeName] || 0) + 1;
    }
    return acc;
  }, {} as { [key: string]: number });

  const topExchanges = Object.entries(exchangeCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalTransactions,
    thisMonth,
    thisWeek,
    recentTransactions,
    topExchanges
  };
}
