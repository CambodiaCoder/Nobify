import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fastify, { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import portfolioRoutes from '../routes/portfolio';
import authRoutes from '../routes/auth';
import fastifyJwt from '@fastify/jwt';
import { 
  calculateTimeBasedPerformance,
  calculateAdvancedMetrics,
  calculateRiskMetrics,
  calculateBenchmarkComparisons,
  getEnhancedPortfolioMetrics
} from '../services/portfolioService';

describe('Enhanced Portfolio Metrics', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  let testHoldingId: string;

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
        email: 'metrics.test@example.com',
        password: 'TestPassword123!',
        name: 'Metrics Test User'
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
        email: 'metrics.test@example.com',
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

    // Add some test transactions for meaningful metrics
    await app.inject({
      method: 'POST',
      url: '/api/portfolio/transactions',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        holdingId: testHoldingId,
        type: 'BUY',
        amount: 0.5,
        pricePerToken: 40000,
        date: '2024-01-01T10:00:00Z',
        notes: 'Initial purchase'
      }
    });

    await app.inject({
      method: 'POST',
      url: '/api/portfolio/transactions',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        holdingId: testHoldingId,
        type: 'BUY',
        amount: 0.5,
        pricePerToken: 45000,
        date: '2024-02-01T10:00:00Z',
        notes: 'Second purchase'
      }
    });
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

  describe('Enhanced Metrics API Endpoints', () => {
    test('should get enhanced portfolio metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/metrics/enhanced',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('metrics' in data);
      
      const metrics = data.metrics;
      assert('summary' in metrics);
      assert('timeBasedPerformance' in metrics);
      assert('advancedMetrics' in metrics);
      assert('benchmarkComparisons' in metrics);
      assert('riskMetrics' in metrics);
    });

    test('should get time-based performance metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/metrics/time-based',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('timeBasedPerformance' in data);
      assert(Array.isArray(data.timeBasedPerformance));
      
      if (data.timeBasedPerformance.length > 0) {
        const performance = data.timeBasedPerformance[0];
        assert('period' in performance);
        assert('startValue' in performance);
        assert('endValue' in performance);
        assert('absoluteReturn' in performance);
        assert('percentageReturn' in performance);
        assert('startDate' in performance);
        assert('endDate' in performance);
      }
    });

    test('should get advanced metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/metrics/advanced',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('advancedMetrics' in data);
      
      const metrics = data.advancedMetrics;
      assert('sharpeRatio' in metrics);
      assert('volatility' in metrics);
      assert('maxDrawdown' in metrics);
      assert('averageReturn' in metrics);
      assert('winRate' in metrics);
      assert('totalTradingDays' in metrics);
    });

    test('should get risk metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/metrics/risk',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('riskMetrics' in data);
      
      const metrics = data.riskMetrics;
      assert('valueAtRisk95' in metrics);
      assert('valueAtRisk99' in metrics);
      assert('conditionalValueAtRisk' in metrics);
      assert('downsideDeviation' in metrics);
      assert('sortinoRatio' in metrics);
    });

    test('should get benchmark comparisons', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/metrics/benchmarks',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('benchmarkComparisons' in data);
      assert(Array.isArray(data.benchmarkComparisons));
    });
  });

  describe('Service Function Tests', () => {
    test('should calculate time-based performance', async () => {
      const performance = await calculateTimeBasedPerformance(testUserId);
      
      assert(Array.isArray(performance));
      // Should have multiple time periods
      const periods = performance.map(p => p.period);
      assert(periods.includes('1D'));
      assert(periods.includes('7D'));
      assert(periods.includes('30D'));
      assert(periods.includes('1Y'));
    });

    test('should calculate advanced metrics', async () => {
      const metrics = await calculateAdvancedMetrics(testUserId);
      
      assert(typeof metrics === 'object');
      assert(typeof metrics.averageReturn === 'number');
      assert(typeof metrics.winRate === 'number');
      assert(typeof metrics.totalTradingDays === 'number');
      // Other metrics might be null for limited data
    });

    test('should calculate risk metrics', async () => {
      const metrics = await calculateRiskMetrics(testUserId);
      
      assert(typeof metrics === 'object');
      // Risk metrics might be null for limited historical data
      assert('valueAtRisk95' in metrics);
      assert('valueAtRisk99' in metrics);
      assert('conditionalValueAtRisk' in metrics);
      assert('downsideDeviation' in metrics);
      assert('sortinoRatio' in metrics);
    });

    test('should calculate benchmark comparisons', async () => {
      const comparisons = await calculateBenchmarkComparisons(testUserId);
      
      assert(Array.isArray(comparisons));
      // Might be empty if historical price data is not available
    });

    test('should get comprehensive enhanced metrics', async () => {
      const metrics = await getEnhancedPortfolioMetrics(testUserId);
      
      assert(typeof metrics === 'object');
      assert('summary' in metrics);
      assert('timeBasedPerformance' in metrics);
      assert('advancedMetrics' in metrics);
      assert('benchmarkComparisons' in metrics);
      assert('riskMetrics' in metrics);
      
      // Verify summary structure
      assert(typeof metrics.summary.totalValue === 'number');
      assert(typeof metrics.summary.holdingsCount === 'number');
      
      // Verify arrays
      assert(Array.isArray(metrics.timeBasedPerformance));
      assert(Array.isArray(metrics.benchmarkComparisons));
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid user ID gracefully', async () => {
      const metrics = await getEnhancedPortfolioMetrics('invalid-user-id');
      
      // Should return fallback data structure
      assert(typeof metrics === 'object');
      assert('summary' in metrics);
      assert(Array.isArray(metrics.timeBasedPerformance));
    });

    test('should handle unauthorized requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/portfolio/metrics/enhanced'
        // No authorization header
      });

      assert.strictEqual(response.statusCode, 401);
    });
  });
});
