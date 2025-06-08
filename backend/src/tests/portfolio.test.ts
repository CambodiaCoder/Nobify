import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fastify, { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import portfolioRoutes from '../routes/portfolio';
import authRoutes from '../routes/auth';
import fastifyJwt from '@fastify/jwt';

describe('Portfolio CRUD Endpoints', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  let testHoldingId: string;
  let testTransactionId: string;

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
        email: 'portfolio.test@example.com',
        password: 'TestPassword123!',
        name: 'Portfolio Test User'
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
        email: 'portfolio.test@example.com',
        password: 'TestPassword123!'
      }
    });

    assert.strictEqual(loginResponse.statusCode, 200);
    const loginData = JSON.parse(loginResponse.payload);
    authToken = loginData.accessToken;
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

  describe('Portfolio Summary', () => {
    test('should get empty portfolio summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/summary',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.summary.holdingsCount, 0);
      assert.strictEqual(data.summary.totalValue, 0);
    });
  });

  describe('Holdings CRUD', () => {
    test('should create a new holding', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/holdings',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          tokenSymbol: 'btc',
          tokenName: 'Bitcoin',
          currentAmount: 0.5
        }
      });

      assert.strictEqual(response.statusCode, 201);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'Holding created successfully');
      assert.strictEqual(data.holding.tokenSymbol, 'BTC'); // Should be normalized to uppercase
      assert.strictEqual(data.holding.currentAmount, 0.5);

      testHoldingId = data.holding.id;
    });

    test('should not create duplicate holding', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/holdings',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          tokenSymbol: 'BTC',
          tokenName: 'Bitcoin',
          currentAmount: 1.0
        }
      });

      assert.strictEqual(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.error, 'Holding for this token already exists');
    });

    test('should get all holdings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/holdings',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.holdings.length, 1);
      assert.strictEqual(data.holdings[0].tokenSymbol, 'BTC');
    });

    test('should get specific holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/portfolio/holdings/${testHoldingId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.holding.id, testHoldingId);
      assert.strictEqual(data.holding.tokenSymbol, 'BTC');
    });

    test('should update holding amount', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/portfolio/holdings/${testHoldingId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          currentAmount: 0.75
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'Holding updated successfully');
      assert.strictEqual(data.holding.currentAmount, 0.75);
    });
  });

  describe('Transactions CRUD', () => {
    test('should create a new transaction', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/transactions',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          holdingId: testHoldingId,
          type: 'BUY',
          amount: 0.5,
          pricePerToken: 50000,
          date: '2024-01-15T10:00:00Z',
          notes: 'Initial purchase'
        }
      });

      assert.strictEqual(response.statusCode, 201);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'Transaction added successfully');
      assert.strictEqual(data.transactionType, 'BUY');
    });

    test('should get transactions for holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/portfolio/holdings/${testHoldingId}/transactions`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.transactions.length, 1);
      assert.strictEqual(data.transactions[0].type, 'BUY');

      testTransactionId = data.transactions[0].id;
    });

    test('should get all user transactions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/transactions',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.transactions.length, 1);
      assert.strictEqual(data.transactions[0].holding.tokenSymbol, 'BTC');
    });

    test('should delete transaction', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/portfolio/transactions/${testTransactionId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'Transaction deleted successfully');
    });
  });

  describe('Portfolio Management', () => {
    test('should refresh portfolio prices', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/refresh-prices',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'Portfolio prices updated successfully');
    });

    test('should delete holding', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/portfolio/holdings/${testHoldingId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'Holding and all associated transactions deleted successfully');
    });
  });

  describe('Error Handling', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/holdings'
      });

      assert.strictEqual(response.statusCode, 401);
    });

    test('should return 404 for non-existent holding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/holdings/non-existent-id',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.statusCode, 404);
    });

    test('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/holdings',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          tokenSymbol: 'ETH'
          // Missing required fields
        }
      });

      assert.strictEqual(response.statusCode, 400);
    });
  });
});
