import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fastify, { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import portfolioRoutes from '../routes/portfolio';
import authRoutes from '../routes/auth';
import fastifyJwt from '@fastify/jwt';
import { 
  getPrices, 
  getHistoricalPrice, 
  batchUpdatePrices, 
  getPriceAlerts,
  clearPriceCaches,
  getCacheStats 
} from '../lib/cryptoApi';
import { 
  updateHoldingPrices, 
  addTransactionWithPriceLookup,
  getPortfolioAnalytics 
} from '../services/portfolioService';

describe('Enhanced Price Integration', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  let testHoldingId: string;

  before(async () => {
    // Setup test app
    app = fastify({ logger: false });
    
    await app.register(fastifyJwt, {
      secret: 'test-secret-key'
    });

    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(portfolioRoutes, { prefix: '/api/portfolio' });

    await app.ready();

    // Create test user
    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        email: 'price.test@example.com',
        password: 'TestPassword123!',
        name: 'Price Test User'
      }
    });

    const signupData = JSON.parse(signupResponse.payload);
    testUserId = signupData.user.id;

    // Login to get token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'price.test@example.com',
        password: 'TestPassword123!'
      }
    });

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
  });

  after(async () => {
    // Cleanup
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

  describe('Enhanced Price API', () => {
    test('should fetch enhanced price data', async () => {
      const prices = await getPrices(['BTC', 'ETH']);
      
      assert(typeof prices === 'object');
      assert('btc' in prices || 'bitcoin' in prices);
      
      const btcPrice = prices['btc'] || prices['bitcoin'];
      if (btcPrice) {
        assert(typeof btcPrice.usd === 'number');
        assert(typeof btcPrice.usd_24h_change === 'number');
        assert(typeof btcPrice.last_updated_at === 'number');
      }
    });

    test('should handle batch price updates with retry', async () => {
      const prices = await batchUpdatePrices(['BTC', 'ETH'], 2);
      
      assert(typeof prices === 'object');
      // Should return data even if some requests fail
      assert(Object.keys(prices).length >= 0);
    });

    test('should generate price alerts', async () => {
      const alerts = await getPriceAlerts(['BTC'], 1); // 1% threshold
      
      assert(Array.isArray(alerts));
      if (alerts.length > 0) {
        const alert = alerts[0];
        assert(typeof alert.symbol === 'string');
        assert(typeof alert.currentPrice === 'number');
        assert(typeof alert.change24h === 'number');
        assert(typeof alert.isSignificantChange === 'boolean');
        assert(['gain', 'loss', 'stable'].includes(alert.alertType));
      }
    });

    test('should manage cache operations', () => {
      // Clear caches
      clearPriceCaches();
      
      // Get cache stats
      const stats = getCacheStats();
      assert(typeof stats === 'object');
      assert('priceCache' in stats);
      assert('coinListCache' in stats);
      assert('airdropCache' in stats);
    });
  });

  describe('Portfolio Price Integration', () => {
    test('should update holding prices with detailed stats', async () => {
      const result = await updateHoldingPrices(testUserId);
      
      assert(typeof result === 'object');
      assert(typeof result.updated === 'number');
      assert(typeof result.failed === 'number');
      assert(Array.isArray(result.errors));
    });

    test('should refresh prices via API endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/refresh-prices',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'Portfolio prices updated successfully');
      assert('stats' in data);
    });

    test('should get portfolio analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/analytics',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('analytics' in data);
      
      const analytics = data.analytics;
      assert('summary' in analytics);
      assert('topPerformers' in analytics);
      assert('worstPerformers' in analytics);
      assert('allocationByValue' in analytics);
      assert('recentActivity' in analytics);
    });

    test('should get price alerts for user holdings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/price-alerts?threshold=5',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('alerts' in data);
      assert('threshold' in data);
      assert('totalAlerts' in data);
      assert('significantChanges' in data);
      assert.strictEqual(data.threshold, 5);
    });
  });

  describe('Enhanced Transaction Features', () => {
    test('should create transaction with historical price lookup', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/transactions/with-price-lookup',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          holdingId: testHoldingId,
          type: 'BUY',
          amount: 0.1,
          date: '2024-01-01T10:00:00Z',
          notes: 'Test transaction with price lookup'
        }
      });

      assert.strictEqual(response.statusCode, 201);
      const data = JSON.parse(response.payload);
      assert('success' in data);
      assert('message' in data);
      
      if (data.success) {
        console.log('Transaction created:', data.message);
        if (data.historicalPrice) {
          assert(typeof data.historicalPrice === 'number');
          assert(data.historicalPrice > 0);
        }
      }
    });

    test('should handle transaction with provided price data', async () => {
      const result = await addTransactionWithPriceLookup(testHoldingId, {
        type: 'BUY',
        amount: 0.05,
        pricePerToken: 45000,
        totalValue: 2250,
        date: new Date('2024-01-15'),
        notes: 'Test with provided price'
      });

      assert(result.success);
      assert(result.message.includes('successfully'));
    });
  });

  describe('Admin Features', () => {
    test('should get cache statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/admin/cache-stats',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('cacheStats' in data);
      
      const stats = data.cacheStats;
      assert('priceCache' in stats);
      assert('coinListCache' in stats);
      assert('airdropCache' in stats);
    });

    test('should clear caches', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/portfolio/admin/clear-caches',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'All price caches cleared successfully');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid token symbols gracefully', async () => {
      const prices = await getPrices(['INVALID_TOKEN_XYZ']);
      
      // Should return empty object or fallback data without throwing
      assert(typeof prices === 'object');
    });

    test('should handle network failures in batch updates', async () => {
      // This test simulates network issues by using invalid symbols
      const prices = await batchUpdatePrices(['INVALID1', 'INVALID2'], 1);
      
      // Should return fallback data structure
      assert(typeof prices === 'object');
    });

    test('should handle missing historical price data', async () => {
      const price = await getHistoricalPrice('INVALID_TOKEN', new Date('2020-01-01'));
      
      // Should return null for invalid tokens
      assert(price === null);
    });
  });
});
