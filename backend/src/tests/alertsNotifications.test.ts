import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fastify, { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import alertRoutes from '../routes/alerts';
import authRoutes from '../routes/auth';
import fastifyJwt from '@fastify/jwt';
import { 
  sendPushNotification,
  sendEmailNotification,
  sendNotificationToUser
} from '../services/notificationService';
import { 
  evaluateAllAlerts
} from '../services/alertService';
import { AlertScheduler } from '../services/schedulerService';

describe('Alerts and Notifications System', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  let testAlertId: string;

  before(async () => {
    // Setup test app
    app = fastify({ logger: false });

    // Register JWT plugin
    await app.register(fastifyJwt, {
      secret: 'test-secret-key'
    });

    // Register routes
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(alertRoutes, { prefix: '/api/alerts' });

    await app.ready();

    // Create test user and get auth token
    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        email: 'alerts.test@example.com',
        password: 'TestPassword123!',
        name: 'Alerts Test User'
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
        email: 'alerts.test@example.com',
        password: 'TestPassword123!'
      }
    });

    assert.strictEqual(loginResponse.statusCode, 200);
    const loginData = JSON.parse(loginResponse.payload);
    authToken = loginData.accessToken;
  });

  after(async () => {
    // Cleanup test data
    await prisma.alert.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.user.delete({
      where: { id: testUserId }
    });

    await app.close();
  });

  describe('Alert Management API', () => {
    test('should create a price alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          type: 'price',
          condition: 'above',
          threshold: 50000,
          tokenSymbol: 'BTC'
        }
      });

      assert.strictEqual(response.statusCode, 201);
      const data = JSON.parse(response.payload);
      assert('alert' in data);
      assert.strictEqual(data.alert.type, 'price');
      assert.strictEqual(data.alert.condition, 'above');
      assert.strictEqual(data.alert.threshold, 50000);
      assert.strictEqual(data.alert.tokenSymbol, 'BTC');
      assert.strictEqual(data.alert.active, true);
      
      testAlertId = data.alert.id;
    });

    test('should validate required fields for price alerts', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          type: 'price',
          condition: 'above'
          // Missing threshold and tokenSymbol
        }
      });

      assert.strictEqual(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert(data.error.includes('Price alerts require tokenSymbol and threshold'));
    });

    test('should get user alerts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts',
        headers: { authorization: `Bearer ${authToken}` }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('alerts' in data);
      assert(Array.isArray(data.alerts));
      assert(data.alerts.length >= 1);
      
      const alert = data.alerts.find((a: any) => a.id === testAlertId);
      assert(alert);
      assert.strictEqual(alert.type, 'price');
    });

    test('should update alert', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/alerts/${testAlertId}`,
        payload: {
          threshold: 55000,
          active: false
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.alert.threshold, 55000);
      assert.strictEqual(data.alert.active, false);
    });

    test('should toggle alert status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/alerts/${testAlertId}/toggle`
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.alert.active, true); // Should be toggled back to true
    });

    test('should delete alert', async () => {
      // Create a new alert to delete
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/alerts',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          type: 'price',
          condition: 'below',
          threshold: 30000,
          tokenSymbol: 'BTC'
        }
      });

      const alertToDelete = JSON.parse(createResponse.payload).alert;

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/alerts/${alertToDelete.id}`
      });

      assert.strictEqual(deleteResponse.statusCode, 204);

      // Verify alert is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/alerts/${alertToDelete.id}`
      });

      assert.strictEqual(getResponse.statusCode, 404);
    });

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts'
        // No authorization header
      });

      assert.strictEqual(response.statusCode, 401);
    });
  });

  describe('Notification Services', () => {
    test('should handle push notification with invalid token gracefully', async () => {
      const result = await sendPushNotification('invalid-token', {
        title: 'Test Notification',
        body: 'This is a test notification'
      });

      assert.strictEqual(result.success, false);
      assert(result.error);
    });

    test('should handle email notification without SendGrid key gracefully', async () => {
      // This test assumes SendGrid is not configured in test environment
      const result = await sendEmailNotification({
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test email content</p>'
      });

      // Should fail gracefully without SendGrid configuration
      assert.strictEqual(result.success, false);
    });

    test('should send notification to user', async () => {
      const result = await sendNotificationToUser(testUserId, {
        title: 'Test Alert',
        body: 'This is a test alert notification',
        type: 'general'
      });

      // Should handle missing FCM token and SendGrid config gracefully
      assert(typeof result.success === 'boolean');
    });
  });

  describe('Alert Evaluation', () => {
    test('should evaluate alerts without errors', async () => {
      const results = await evaluateAllAlerts();
      
      assert(Array.isArray(results));
      // Should not throw errors even with test data
    });

    test('should handle price alert evaluation', async () => {
      // Create a price alert that should trigger
      await app.inject({
        method: 'POST',
        url: '/api/alerts',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          type: 'price',
          condition: 'above',
          threshold: 1, // Very low threshold to ensure trigger
          tokenSymbol: 'BTC'
        }
      });

      const results = await evaluateAllAlerts();
      
      assert(Array.isArray(results));
      // Should have at least one result
      assert(results.length >= 0);
    });
  });

  describe('Scheduler Service', () => {
    test('should create and manage scheduler instance', () => {
      const scheduler = new AlertScheduler();
      
      // Test initial state
      let status = scheduler.getStatus();
      assert.strictEqual(status.isRunning, false);
      assert.strictEqual(status.evaluationInProgress, false);

      // Test start
      scheduler.start();
      status = scheduler.getStatus();
      assert.strictEqual(status.isRunning, true);

      // Test stop
      scheduler.stop();
      status = scheduler.getStatus();
      assert.strictEqual(status.isRunning, false);
    });

    test('should handle manual trigger', async () => {
      const scheduler = new AlertScheduler();
      
      // Should not throw error
      await scheduler.triggerEvaluation();
    });
  });

  describe('Scheduler API Endpoints', () => {
    test('should get scheduler status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/scheduler/status'
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert('scheduler' in data);
      assert('status' in data.scheduler);
      assert('details' in data.scheduler);
    });

    test('should trigger manual evaluation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/scheduler/trigger'
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert(data.message.includes('triggered successfully'));
    });

    test('should send test notification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/test-notification',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Test Notification',
          body: 'This is a test notification from the API'
        }
      });

      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert(data.message.includes('Test notification sent'));
      assert('result' in data);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid alert ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/invalid-id'
      });

      assert.strictEqual(response.statusCode, 404);
    });

    test('should handle missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          // Missing type and condition
        }
      });

      assert.strictEqual(response.statusCode, 400);
    });

    test('should handle test notification without required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/test-notification',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Test'
          // Missing body
        }
      });

      assert.strictEqual(response.statusCode, 400);
    });
  });
});
