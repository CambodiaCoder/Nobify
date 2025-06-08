import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { TransactionType } from '../generated/prisma';
import {
  getPortfolioSummary,
  getHoldingsWithMetrics,
  addTransaction,
  addTransactionWithPriceLookup,
  calculateHoldingMetrics,
  updateHoldingPrices,
  getPortfolioAnalytics,
  bulkUpdateAllUserPrices,
  getEnhancedPortfolioMetrics,
  calculateTimeBasedPerformance,
  calculateAdvancedMetrics,
  calculateRiskMetrics,
  calculateBenchmarkComparisons,
  getTransactionHistory,
  getTransactionAnalytics,
  bulkImportTransactions,
  exportTransactionsToCSV,
  updateTransaction,
  getTransactionStats,
  validateTransactionData
} from '../services/portfolioService';
import { getPriceAlerts, getCacheStats, clearPriceCaches } from '../lib/cryptoApi';

// Validation schemas
const createHoldingSchema = {
  type: 'object',
  required: ['tokenSymbol', 'tokenName', 'currentAmount'],
  properties: {
    tokenSymbol: { type: 'string', minLength: 1, maxLength: 10 },
    tokenName: { type: 'string', minLength: 1, maxLength: 100 },
    currentAmount: { type: 'number', minimum: 0 }
  }
};

const updateHoldingSchema = {
  type: 'object',
  required: ['currentAmount'],
  properties: {
    currentAmount: { type: 'number', minimum: 0 }
  }
};

const createTransactionSchema = {
  type: 'object',
  required: ['holdingId', 'type', 'amount', 'date'],
  properties: {
    holdingId: { type: 'string' },
    type: { type: 'string', enum: ['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT', 'STAKE', 'UNSTAKE', 'REWARD', 'AIRDROP'] },
    amount: { type: 'number', minimum: 0 },
    pricePerToken: { type: 'number', minimum: 0 },
    totalValue: { type: 'number', minimum: 0 },
    transactionFee: { type: 'number', minimum: 0 },
    feeTokenSymbol: { type: 'string', maxLength: 10 },
    exchangeName: { type: 'string', maxLength: 50 },
    transactionHash: { type: 'string', maxLength: 100 },
    date: { type: 'string', format: 'date-time' },
    notes: { type: 'string', maxLength: 500 }
  }
};

export default async function (fastify: FastifyInstance) {
  // Get user's portfolio summary and holdings
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const [summary, holdings] = await Promise.all([
        getPortfolioSummary(userId),
        getHoldingsWithMetrics(userId)
      ]);

      return {
        summary,
        holdings
      };
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      reply.code(500).send({ error: 'Failed to fetch portfolio' });
    }
  });

  // Get portfolio summary only
  fastify.get('/summary', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const summary = await getPortfolioSummary(userId);
      return { summary };
    } catch (error) {
      console.error('Error fetching portfolio summary:', error);
      reply.code(500).send({ error: 'Failed to fetch portfolio summary' });
    }
  });

  // Get all holdings for authenticated user
  fastify.get('/holdings', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const holdings = await getHoldingsWithMetrics(userId);
      return { holdings };
    } catch (error) {
      console.error('Error fetching holdings:', error);
      reply.code(500).send({ error: 'Failed to fetch holdings' });
    }
  });

  // Get specific holding
  fastify.get('/holdings/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    try {
      const holding = await prisma.portfolioHolding.findFirst({
        where: {
          id,
          userId // Ensure user can only access their own holdings
        },
        include: {
          transactions: {
            orderBy: { date: 'desc' }
          }
        }
      });

      if (!holding) {
        reply.code(404).send({ error: 'Holding not found' });
        return;
      }

      return { holding };
    } catch (error) {
      console.error('Error fetching holding:', error);
      reply.code(500).send({ error: 'Failed to fetch holding' });
    }
  });

  // Add new holding
  fastify.post('/holdings', {
    preHandler: [requireAuth],
    schema: { body: createHoldingSchema }
  }, async (request, reply) => {
    const userId = request.user.id;
    const { tokenSymbol, tokenName, currentAmount } = request.body as {
      tokenSymbol: string;
      tokenName: string;
      currentAmount: number;
    };

    try {
      // Normalize token symbol to uppercase
      const normalizedSymbol = tokenSymbol.toUpperCase();

      // Check if holding already exists for this user and token
      const existingHolding = await prisma.portfolioHolding.findUnique({
        where: {
          userId_tokenSymbol: {
            userId,
            tokenSymbol: normalizedSymbol
          }
        }
      });

      if (existingHolding) {
        reply.code(400).send({
          error: 'Holding for this token already exists',
          existingHolding: {
            id: existingHolding.id,
            tokenSymbol: existingHolding.tokenSymbol,
            currentAmount: existingHolding.currentAmount
          }
        });
        return;
      }

      const holding = await prisma.portfolioHolding.create({
        data: {
          userId,
          tokenSymbol: normalizedSymbol,
          tokenName,
          currentAmount
        }
      });

      reply.code(201).send({
        message: 'Holding created successfully',
        holding
      });
    } catch (error) {
      console.error('Error creating holding:', error);
      reply.code(500).send({ error: 'Failed to create holding' });
    }
  });

  // Update holding (mainly for manual adjustments)
  fastify.put('/holdings/:id', {
    preHandler: [requireAuth],
    schema: { body: updateHoldingSchema }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const { currentAmount } = request.body as { currentAmount: number };

    try {
      // Verify holding belongs to user
      const existingHolding = await prisma.portfolioHolding.findFirst({
        where: { id, userId }
      });

      if (!existingHolding) {
        reply.code(404).send({ error: 'Holding not found' });
        return;
      }

      const holding = await prisma.portfolioHolding.update({
        where: { id },
        data: {
          currentAmount,
          updatedAt: new Date()
        }
      });

      // Recalculate metrics after manual update
      await calculateHoldingMetrics(id);

      reply.code(200).send({
        message: 'Holding updated successfully',
        holding
      });
    } catch (error) {
      console.error('Error updating holding:', error);
      reply.code(500).send({ error: 'Failed to update holding' });
    }
  });

  // Delete holding
  fastify.delete('/holdings/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    try {
      // Verify holding belongs to user
      const existingHolding = await prisma.portfolioHolding.findFirst({
        where: { id, userId }
      });

      if (!existingHolding) {
        reply.code(404).send({ error: 'Holding not found' });
        return;
      }

      // Use transaction to ensure data consistency
      await prisma.$transaction(async (tx) => {
        // First delete all transactions associated with this holding
        await tx.transaction.deleteMany({
          where: { holdingId: id }
        });

        // Then delete the holding
        await tx.portfolioHolding.delete({
          where: { id }
        });
      });

      reply.code(200).send({
        message: 'Holding and all associated transactions deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting holding:', error);
      reply.code(500).send({ error: 'Failed to delete holding' });
    }
  });

  // Add transaction to holding
  fastify.post('/transactions', {
    preHandler: [requireAuth],
    schema: { body: createTransactionSchema }
  }, async (request, reply) => {
    const userId = request.user.id;
    const {
      holdingId,
      type,
      amount,
      pricePerToken,
      totalValue,
      transactionFee,
      feeTokenSymbol,
      exchangeName,
      transactionHash,
      date,
      notes
    } = request.body as {
      holdingId: string;
      type: TransactionType;
      amount: number;
      pricePerToken?: number;
      totalValue?: number;
      transactionFee?: number;
      feeTokenSymbol?: string;
      exchangeName?: string;
      transactionHash?: string;
      date: string;
      notes?: string;
    };

    try {
      // Verify holding belongs to user
      const holding = await prisma.portfolioHolding.findFirst({
        where: { id: holdingId, userId }
      });

      if (!holding) {
        reply.code(404).send({ error: 'Holding not found' });
        return;
      }

      // Calculate totalValue if not provided
      const calculatedTotalValue = totalValue || (pricePerToken && amount ? pricePerToken * amount : undefined);

      await addTransaction(holdingId, {
        type,
        amount,
        pricePerToken,
        totalValue: calculatedTotalValue,
        transactionFee,
        feeTokenSymbol,
        exchangeName,
        transactionHash,
        date: new Date(date),
        notes
      });

      reply.code(201).send({
        message: 'Transaction added successfully',
        holdingId,
        transactionType: type,
        amount
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      reply.code(500).send({ error: 'Failed to create transaction' });
    }
  });

  // Get transactions for a holding
  fastify.get('/holdings/:id/transactions', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    try {
      // Verify holding belongs to user
      const holding = await prisma.portfolioHolding.findFirst({
        where: { id, userId }
      });

      if (!holding) {
        reply.code(404).send({ error: 'Holding not found' });
        return;
      }

      const transactions = await prisma.transaction.findMany({
        where: { holdingId: id },
        orderBy: { date: 'desc' }
      });

      return {
        transactions,
        holdingInfo: {
          id: holding.id,
          tokenSymbol: holding.tokenSymbol,
          tokenName: holding.tokenName
        }
      };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      reply.code(500).send({ error: 'Failed to fetch transactions' });
    }
  });

  // Get all transactions for user
  fastify.get('/transactions', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          holding: { userId }
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

      return { transactions };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      reply.code(500).send({ error: 'Failed to fetch transactions' });
    }
  });

  // Get specific transaction
  fastify.get('/transactions/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    try {
      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
          holding: { userId }
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

      if (!transaction) {
        reply.code(404).send({ error: 'Transaction not found' });
        return;
      }

      return { transaction };
    } catch (error) {
      console.error('Error fetching transaction:', error);
      reply.code(500).send({ error: 'Failed to fetch transaction' });
    }
  });

  // Delete transaction
  fastify.delete('/transactions/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    try {
      // Get the transaction and verify it belongs to user
      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
          holding: { userId }
        },
        include: { holding: true }
      });

      if (!transaction) {
        reply.code(404).send({ error: 'Transaction not found' });
        return;
      }

      const holdingId = transaction.holdingId;

      // Delete the transaction
      await prisma.transaction.delete({
        where: { id }
      });

      // Recalculate holding metrics after deletion
      await calculateHoldingMetrics(holdingId);

      reply.code(200).send({
        message: 'Transaction deleted successfully',
        holdingId,
        deletedTransactionType: transaction.type
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      reply.code(500).send({ error: 'Failed to delete transaction' });
    }
  });

  // Update portfolio prices manually
  fastify.post('/refresh-prices', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const result = await updateHoldingPrices(userId);

      reply.code(200).send({
        message: 'Portfolio prices updated successfully',
        stats: result
      });
    } catch (error) {
      console.error('Error updating prices:', error);
      reply.code(500).send({ error: 'Failed to update prices' });
    }
  });

  // Enhanced transaction creation with historical price lookup
  fastify.post('/transactions/with-price-lookup', {
    preHandler: [requireAuth],
    schema: { body: createTransactionSchema }
  }, async (request, reply) => {
    const userId = request.user.id;
    const transactionData = request.body as any;

    try {
      // Verify holding belongs to user
      const holding = await prisma.portfolioHolding.findFirst({
        where: { id: transactionData.holdingId, userId }
      });

      if (!holding) {
        reply.code(404).send({ error: 'Holding not found' });
        return;
      }

      const result = await addTransactionWithPriceLookup(transactionData.holdingId, {
        type: transactionData.type,
        amount: transactionData.amount,
        pricePerToken: transactionData.pricePerToken,
        totalValue: transactionData.totalValue,
        transactionFee: transactionData.transactionFee,
        feeTokenSymbol: transactionData.feeTokenSymbol,
        exchangeName: transactionData.exchangeName,
        transactionHash: transactionData.transactionHash,
        date: new Date(transactionData.date),
        notes: transactionData.notes
      });

      reply.code(201).send(result);
    } catch (error) {
      console.error('Error creating transaction with price lookup:', error);
      reply.code(500).send({ error: 'Failed to create transaction' });
    }
  });

  // Enhanced transaction history with filtering and pagination
  fastify.get('/transactions/history', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const {
      page = 1,
      limit = 20,
      sortBy = 'date',
      sortOrder = 'desc',
      holdingId,
      type,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      exchangeName,
      search
    } = request.query as {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
      holdingId?: string;
      type?: string | string[];
      dateFrom?: string;
      dateTo?: string;
      amountMin?: number;
      amountMax?: number;
      exchangeName?: string;
      search?: string;
    };

    try {
      const filter = {
        userId,
        ...(holdingId && { holdingId }),
        ...(type && { type: Array.isArray(type) ? type as TransactionType[] : type as TransactionType }),
        ...(dateFrom && { dateFrom: new Date(dateFrom) }),
        ...(dateTo && { dateTo: new Date(dateTo) }),
        ...(amountMin !== undefined && { amountMin }),
        ...(amountMax !== undefined && { amountMax }),
        ...(exchangeName && { exchangeName }),
        ...(search && { search })
      };

      const pagination = {
        page: Number(page),
        limit: Math.min(Number(limit), 100), // Max 100 per page
        sortBy: sortBy as any,
        sortOrder: sortOrder as any
      };

      const result = await getTransactionHistory(filter, pagination);
      return result;
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      reply.code(500).send({ error: 'Failed to fetch transaction history' });
    }
  });

  // Get transaction analytics
  fastify.get('/transactions/analytics', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const { dateFrom, dateTo } = request.query as { dateFrom?: string; dateTo?: string };

    try {
      const analytics = await getTransactionAnalytics(
        userId,
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined
      );
      return { analytics };
    } catch (error) {
      console.error('Error fetching transaction analytics:', error);
      reply.code(500).send({ error: 'Failed to fetch transaction analytics' });
    }
  });

  // Export transactions to CSV
  fastify.get('/transactions/export', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const { holdingId, type, dateFrom, dateTo } = request.query as {
      holdingId?: string;
      type?: string | string[];
      dateFrom?: string;
      dateTo?: string;
    };

    try {
      const filter = {
        userId,
        ...(holdingId && { holdingId }),
        ...(type && { type: Array.isArray(type) ? type as TransactionType[] : type as TransactionType }),
        ...(dateFrom && { dateFrom: new Date(dateFrom) }),
        ...(dateTo && { dateTo: new Date(dateTo) })
      };

      const csvContent = await exportTransactionsToCSV(userId, filter);

      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="transactions.csv"')
        .send(csvContent);
    } catch (error) {
      console.error('Error exporting transactions:', error);
      reply.code(500).send({ error: 'Failed to export transactions' });
    }
  });

  // Bulk import transactions
  fastify.post('/transactions/bulk-import', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const { transactions } = request.body as { transactions: any[] };

    if (!Array.isArray(transactions) || transactions.length === 0) {
      reply.code(400).send({ error: 'Invalid transactions data' });
      return;
    }

    try {
      const result = await bulkImportTransactions(userId, transactions);

      reply.code(200).send({
        message: 'Bulk import completed',
        result
      });
    } catch (error) {
      console.error('Error bulk importing transactions:', error);
      reply.code(500).send({ error: 'Failed to import transactions' });
    }
  });

  // Update transaction
  fastify.put('/transactions/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const updateData = request.body as any;

    try {
      const result = await updateTransaction(id, userId, updateData);

      if (result.success) {
        reply.code(200).send(result);
      } else {
        reply.code(400).send({ error: result.message });
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      reply.code(500).send({ error: 'Failed to update transaction' });
    }
  });

  // Get transaction statistics for dashboard
  fastify.get('/transactions/stats', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const stats = await getTransactionStats(userId);
      return { stats };
    } catch (error) {
      console.error('Error fetching transaction stats:', error);
      reply.code(500).send({ error: 'Failed to fetch transaction stats' });
    }
  });

  // Get portfolio analytics
  fastify.get('/analytics', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const analytics = await getPortfolioAnalytics(userId);
      return { analytics };
    } catch (error) {
      console.error('Error fetching portfolio analytics:', error);
      reply.code(500).send({ error: 'Failed to fetch analytics' });
    }
  });

  // Get enhanced portfolio performance metrics
  fastify.get('/metrics/enhanced', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const enhancedMetrics = await getEnhancedPortfolioMetrics(userId);
      return { metrics: enhancedMetrics };
    } catch (error) {
      console.error('Error fetching enhanced portfolio metrics:', error);
      reply.code(500).send({ error: 'Failed to fetch enhanced metrics' });
    }
  });

  // Get time-based performance metrics only
  fastify.get('/metrics/time-based', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const timeBasedPerformance = await calculateTimeBasedPerformance(userId);
      return { timeBasedPerformance };
    } catch (error) {
      console.error('Error fetching time-based performance:', error);
      reply.code(500).send({ error: 'Failed to fetch time-based performance' });
    }
  });

  // Get advanced metrics only (Sharpe ratio, volatility, etc.)
  fastify.get('/metrics/advanced', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const advancedMetrics = await calculateAdvancedMetrics(userId);
      return { advancedMetrics };
    } catch (error) {
      console.error('Error fetching advanced metrics:', error);
      reply.code(500).send({ error: 'Failed to fetch advanced metrics' });
    }
  });

  // Get risk metrics only (VaR, Sortino ratio, etc.)
  fastify.get('/metrics/risk', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const riskMetrics = await calculateRiskMetrics(userId);
      return { riskMetrics };
    } catch (error) {
      console.error('Error fetching risk metrics:', error);
      reply.code(500).send({ error: 'Failed to fetch risk metrics' });
    }
  });

  // Get benchmark comparisons only
  fastify.get('/metrics/benchmarks', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const benchmarkComparisons = await calculateBenchmarkComparisons(userId);
      return { benchmarkComparisons };
    } catch (error) {
      console.error('Error fetching benchmark comparisons:', error);
      reply.code(500).send({ error: 'Failed to fetch benchmark comparisons' });
    }
  });

  // Get price alerts for user's holdings
  fastify.get('/price-alerts', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const { threshold } = request.query as { threshold?: string };

    try {
      const holdings = await prisma.portfolioHolding.findMany({
        where: { userId },
        select: { tokenSymbol: true }
      });

      const tokenSymbols = holdings.map(h => h.tokenSymbol);
      const thresholdPercentage = threshold ? parseFloat(threshold) : 5;

      const alerts = await getPriceAlerts(tokenSymbols, thresholdPercentage);

      return {
        alerts,
        threshold: thresholdPercentage,
        totalAlerts: alerts.length,
        significantChanges: alerts.filter(a => a.isSignificantChange).length
      };
    } catch (error) {
      console.error('Error fetching price alerts:', error);
      reply.code(500).send({ error: 'Failed to fetch price alerts' });
    }
  });

  // Admin endpoint: Bulk update all user prices
  fastify.post('/admin/bulk-update-prices', { preHandler: [requireAuth] }, async (request, reply) => {
    // Note: In production, add admin role check here
    try {
      const result = await bulkUpdateAllUserPrices();

      reply.code(200).send({
        message: 'Bulk price update completed',
        stats: result
      });
    } catch (error) {
      console.error('Error in bulk price update:', error);
      reply.code(500).send({ error: 'Failed to perform bulk update' });
    }
  });

  // Admin endpoint: Get cache statistics
  fastify.get('/admin/cache-stats', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const stats = getCacheStats();
      return { cacheStats: stats };
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      reply.code(500).send({ error: 'Failed to fetch cache stats' });
    }
  });

  // Admin endpoint: Clear price caches
  fastify.post('/admin/clear-caches', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      clearPriceCaches();

      reply.code(200).send({
        message: 'All price caches cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing caches:', error);
      reply.code(500).send({ error: 'Failed to clear caches' });
    }
  });
}