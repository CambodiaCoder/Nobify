import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { alertScheduler, getSchedulerHealth } from '../services/schedulerService';

// Authentication middleware
const requireAuth = async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Authentication required' });
  }
};

export default async function (fastify: FastifyInstance) {
  // Get current user's alerts
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const alerts = await prisma.alert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return { alerts };
    } catch (error) {
      console.error('Error fetching alerts:', error);
      reply.code(500).send({ error: 'Failed to fetch alerts' });
    }
  });

  // Get user's alerts (legacy endpoint for backward compatibility)
  fastify.get('/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    try {
      const alerts = await prisma.alert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return { alerts };
    } catch (error) {
      console.error('Error fetching alerts:', error);
      reply.code(500).send({ error: 'Failed to fetch alerts' });
    }
  });

  // Get specific alert
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const alert = await prisma.alert.findUnique({
        where: { id }
      });
      
      if (!alert) {
        reply.code(404).send({ error: 'Alert not found' });
        return;
      }
      
      return { alert };
    } catch (error) {
      console.error('Error fetching alert:', error);
      throw new Error('Failed to fetch alert');
    }
  });

  // Create alert
  fastify.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const {
      type,
      condition,
      threshold,
      tokenSymbol,
      airdropId
    } = request.body as {
      type: string;
      condition: string;
      threshold?: number;
      tokenSymbol?: string;
      airdropId?: string;
    };

    // Validate required fields
    if (!type || !condition) {
      reply.code(400).send({ error: 'Type and condition are required' });
      return;
    }

    // Validate type-specific requirements
    if (type === 'price' && (!tokenSymbol || threshold === undefined)) {
      reply.code(400).send({ error: 'Price alerts require tokenSymbol and threshold' });
      return;
    }

    if (type === 'airdrop' && !airdropId) {
      reply.code(400).send({ error: 'Airdrop alerts require airdropId' });
      return;
    }

    try {
      const alert = await prisma.alert.create({
        data: {
          userId,
          type,
          condition,
          threshold,
          tokenSymbol: tokenSymbol?.toUpperCase(),
          airdropId,
          active: true
        }
      });

      reply.code(201).send({ alert });
    } catch (error) {
      console.error('Error creating alert:', error);
      reply.code(500).send({ error: 'Failed to create alert' });
    }
  });

  // Update alert
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { 
      condition, 
      threshold, 
      active 
    } = request.body as { 
      condition?: string; 
      threshold?: number; 
      active?: boolean;
    };
    
    try {
      const alert = await prisma.alert.update({
        where: { id },
        data: {
          ...(condition && { condition }),
          ...(threshold !== undefined && { threshold }),
          ...(active !== undefined && { active })
        }
      });
      
      return { alert };
    } catch (error) {
      console.error('Error updating alert:', error);
      throw new Error('Failed to update alert');
    }
  });

  // Delete alert
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      await prisma.alert.delete({
        where: { id }
      });
      
      reply.code(204).send();
    } catch (error) {
      console.error('Error deleting alert:', error);
      throw new Error('Failed to delete alert');
    }
  });

  // Toggle alert active status
  fastify.put('/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const alert = await prisma.alert.findUnique({
        where: { id }
      });
      
      if (!alert) {
        reply.code(404).send({ error: 'Alert not found' });
        return;
      }
      
      const updatedAlert = await prisma.alert.update({
        where: { id },
        data: { active: !alert.active }
      });
      
      return { alert: updatedAlert };
    } catch (error) {
      console.error('Error toggling alert:', error);
      throw new Error('Failed to toggle alert');
    }
  });

  // Mark alert as triggered
  fastify.put('/:id/trigger', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const alert = await prisma.alert.update({
        where: { id },
        data: { lastTriggered: new Date() }
      });

      return { alert };
    } catch (error) {
      console.error('Error marking alert as triggered:', error);
      reply.code(500).send({ error: 'Failed to mark alert as triggered' });
    }
  });

  // Get scheduler status (admin endpoint)
  fastify.get('/scheduler/status', async (request, reply) => {
    try {
      const health = getSchedulerHealth();
      return { scheduler: health };
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      reply.code(500).send({ error: 'Failed to get scheduler status' });
    }
  });

  // Manually trigger alert evaluation (admin endpoint)
  fastify.post('/scheduler/trigger', async (request, reply) => {
    try {
      await alertScheduler.triggerEvaluation();
      return { message: 'Alert evaluation triggered successfully' };
    } catch (error) {
      console.error('Error triggering alert evaluation:', error);
      reply.code(500).send({ error: 'Failed to trigger alert evaluation' });
    }
  });

  // Test notification endpoint (for development)
  fastify.post('/test-notification', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const { title, body, type } = request.body as { title: string; body: string; type?: string };

    if (!title || !body) {
      reply.code(400).send({ error: 'Title and body are required' });
      return;
    }

    try {
      const { sendNotificationToUser } = await import('../services/notificationService');

      const result = await sendNotificationToUser(userId, {
        title,
        body,
        type: (type as any) || 'general'
      });

      return {
        message: 'Test notification sent',
        result
      };
    } catch (error) {
      console.error('Error sending test notification:', error);
      reply.code(500).send({ error: 'Failed to send test notification' });
    }
  });
}