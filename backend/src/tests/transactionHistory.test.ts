import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fastify, { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import portfolioRoutes from '../routes/portfolio';
import authRoutes from '../routes/auth';
import fastifyJwt from '@fastify/jwt';
import { 
  getTransactionHistory,
  getTransactionAnalytics,
  bulkImportTransactions,
  exportTransactionsToCSV,
  updateTransaction,
  getTransactionStats,
  validateTransactionData
} from '../services/portfolioService';

describe('Enhanced Transaction History', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  let testHoldingId: string;
  let testTransactionIds: string[] = [];

  before(async () => {
    // Setup test app
    app = fastify({ logger: false });

    // Register JWT plugin
    await app.register(fastifyJwt, {
      secret: 'test-secret-key'
    });

    // Register routes
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(portfolioRoutes, { prefix: '/api/portfolio' });

    await app.ready();

    // Create test user and get auth token
    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        email: 'transaction.history@example.com',
        password: 'TestPassword123!',
        name: 'Transaction History Test User'
      }
    });

    assert.strictEqual(signupResponse.statusCode, 201);
    const signupData = JSON.parse(signupResponse.payload);
    testUserId = signupData.user.id;

    // Login to get token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'transaction.history@example.com',
        password: 'TestPassword123!'
      }
    });

    assert.strictEqual(loginResponse.statusCode, 200);
    const loginData = JSON.parse(loginResponse.payload);
    authToken = loginData.accessToken;

    // Create test holding
    const holdingResponse = await app.inject({
      method: 'POST',
      url: '/api/portfolio/holdings',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        tokenSymbol: 'BTC',
        tokenName: 'Bitcoin',
        currentAmount: 1.0
      }
    });

    const holdingData = JSON.parse(holdingResponse.payload);
    testHoldingId = holdingData.holding.id;

    // Create multiple test transactions for comprehensive testing
    const transactions = [
      {
        type: 'BUY',
        amount: 0.5,
        pricePerToken: 40000,
        date: '2024-01-01T10:00:00Z',
        exchangeName: 'Coinbase',
        notes: 'First purchase'
      },
      {
        type: 'BUY',
        amount: 0.3,
        pricePerToken: 45000,
        date: '2024-02-01T10:00:00Z',
        exchangeName: 'Binance',
        notes: 'Second purchase'
      },
      {
        type: 'SELL',
        amount: 0.2,
        pricePerToken: 50000,
        date: '2024-03-01T10:00:00Z',
        exchangeName: 'Coinbase',
        notes: 'Partial sale'
      },
      {
        type: 'TRANSFER_IN',
        amount: 0.1,
        date: '2024-04-01T10:00:00Z',
        notes: 'Transfer from wallet'
      }
    ];

    for (const txData of transactions) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/transactions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          holdingId: testHoldingId,
          ...txData
        }
      });
      
      if (response.statusCode === 201) {
        // Get the transaction ID from the database
        const createdTx = await prisma.transaction.findFirst({
          where: {
            holdingId: testHoldingId,
            type: txData.type,
            amount: txData.amount
          },
          orderBy: { createdAt: 'desc' }
        });
        if (createdTx) {
          testTransactionIds.push(createdTx.id);
        }
      }
    }
  });

  after(async () => {
    // Cleanup test data
    await prisma.transaction.deleteMany({
      where: { holding: { userId: testUserId } }
    });
    await prisma.portfolioHolding.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.user.delete({
      where: { id: testUserId }
    });

    await app.close();
  });

  describe('Enhanced Transaction History API', () => {
    test('should get paginated transaction history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/history?page=1&limit=10',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      
      assert('transactions' in data);
      assert('totalCount' in data);
      assert('totalPages' in data);
      assert('currentPage' in data);
      assert(Array.isArray(data.transactions));
      assert(data.totalCount >= 4); // We created 4 transactions
    });

    test('should filter transactions by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/history?type=BUY',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      
      // Should only return BUY transactions
      data.transactions.forEach((tx: any) => {
        assert.strictEqual(tx.type, 'BUY');
      });
    });

    test('should filter transactions by date range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/history?dateFrom=2024-02-01&dateTo=2024-03-31',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      
      // Should return transactions within date range
      data.transactions.forEach((tx: any) => {
        const txDate = new Date(tx.date);
        assert(txDate >= new Date('2024-02-01'));
        assert(txDate <= new Date('2024-03-31'));
      });
    });

    test('should search transactions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/history?search=Coinbase',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      
      // Should return transactions with Coinbase in exchange name
      data.transactions.forEach((tx: any) => {
        assert(tx.exchangeName?.includes('Coinbase'));
      });
    });

    test('should get transaction analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/analytics',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      
      assert('analytics' in data);
      const analytics = data.analytics;
      assert('totalTransactions' in analytics);
      assert('transactionsByType' in analytics);
      assert('totalVolume' in analytics);
      assert('averageTransactionSize' in analytics);
      assert('transactionFrequency' in analytics);
      assert('dateRange' in analytics);
      
      assert(analytics.totalTransactions >= 4);
      assert(analytics.transactionsByType.BUY >= 2);
      assert(analytics.transactionsByType.SELL >= 1);
    });

    test('should export transactions to CSV', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/export',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      assert(response.headers['content-type']?.includes('text/csv'));
      assert(response.headers['content-disposition']?.includes('attachment'));
      
      const csvContent = response.payload;
      assert(csvContent.includes('Date,Token Symbol'));
      assert(csvContent.includes('BTC'));
    });

    test('should get transaction statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/stats',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      
      assert('stats' in data);
      const stats = data.stats;
      assert('totalTransactions' in stats);
      assert('thisMonth' in stats);
      assert('thisWeek' in stats);
      assert('recentTransactions' in stats);
      assert('topExchanges' in stats);
      
      assert(Array.isArray(stats.recentTransactions));
      assert(Array.isArray(stats.topExchanges));
    });

    test('should update transaction', async () => {
      if (testTransactionIds.length === 0) return;
      
      const response = await app.inject({
        method: 'PUT',
        url: `/api/portfolio/transactions/${testTransactionIds[0]}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          notes: 'Updated transaction notes',
          exchangeName: 'Updated Exchange'
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      
      assert(data.success);
      assert(data.transaction.notes === 'Updated transaction notes');
      assert(data.transaction.exchangeName === 'Updated Exchange');
    });
  });

  describe('Service Function Tests', () => {
    test('should validate transaction data', () => {
      const validData = {
        holdingId: 'test-id',
        type: 'BUY',
        amount: 1.0,
        date: '2024-01-01T10:00:00Z'
      };
      
      const validation = validateTransactionData(validData);
      assert(validation.isValid);
      assert.strictEqual(validation.errors.length, 0);
    });

    test('should reject invalid transaction data', () => {
      const invalidData = {
        type: 'INVALID_TYPE',
        amount: -1,
        date: 'invalid-date'
      };
      
      const validation = validateTransactionData(invalidData);
      assert(!validation.isValid);
      assert(validation.errors.length > 0);
    });

    test('should get transaction history with filters', async () => {
      const filter = {
        userId: testUserId,
        type: 'BUY' as any
      };
      
      const pagination = {
        page: 1,
        limit: 10
      };
      
      const result = await getTransactionHistory(filter, pagination);
      
      assert(typeof result === 'object');
      assert(Array.isArray(result.transactions));
      assert(typeof result.totalCount === 'number');
      assert(typeof result.totalPages === 'number');
      assert(typeof result.currentPage === 'number');
    });

    test('should get transaction analytics', async () => {
      const analytics = await getTransactionAnalytics(testUserId);
      
      assert(typeof analytics === 'object');
      assert(typeof analytics.totalTransactions === 'number');
      assert(typeof analytics.transactionsByType === 'object');
      assert(typeof analytics.totalVolume === 'number');
      assert(typeof analytics.averageTransactionSize === 'number');
    });

    test('should export transactions to CSV', async () => {
      const csvContent = await exportTransactionsToCSV(testUserId);
      
      assert(typeof csvContent === 'string');
      assert(csvContent.includes('Date,Token Symbol'));
      assert(csvContent.length > 0);
    });
  });

  describe('Error Handling', () => {
    test('should handle unauthorized requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/history'
        // No authorization header
      });

      assert.strictEqual(response.statusCode, 401);
    });

    test('should handle invalid pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions/history?page=0&limit=1000',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      
      // Should handle invalid parameters gracefully
      assert('transactions' in data);
    });
  });
});
