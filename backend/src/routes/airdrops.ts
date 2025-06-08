import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { getAirdrops } from '../lib/cryptoApi';
import { requireAuth } from '../middleware/auth';

export default async function (fastify: FastifyInstance) {
  // Get all airdrops for the authenticated user with filters
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const { status, upcoming, completed } = request.query as { status?: string; upcoming?: string; completed?: string };

    try {
      let whereClause: any = { userId };

      if (status) {
        whereClause.status = status;
      }

      if (upcoming === 'true') {
        whereClause.airdrop = {
          deadline: {
            gt: new Date(),
          },
        };
      }

      if (completed === 'true') {
        whereClause.status = 'claimed'; // Assuming 'claimed' means completed
      }

      const userAirdrops = await prisma.userAirdrop.findMany({
        where: whereClause,
        include: {
          airdrop: true,
        },
      });
      return { airdrops: userAirdrops };
    } catch (error) {
      console.error('Error fetching user airdrops:', error);
      reply.code(500).send({ error: 'Failed to fetch user airdrops' });
    }
  });

  // Get user airdrop by ID
  fastify.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    try {
      const userAirdrop = await prisma.userAirdrop.findUnique({
        where: {
          userId_airdropId: {
            userId: userId,
            airdropId: id,
          },
        },
        include: {
          airdrop: true,
        },
      });

      if (!userAirdrop) {
        reply.code(404).send({ error: 'User airdrop not found' });
        return;
      }

      return { airdrop: userAirdrop };
    } catch (error) {
      console.error('Error fetching user airdrop:', error);
      reply.code(500).send({ error: 'Failed to fetch user airdrop' });
    }
  });

  // Toggle airdrop claim status for authenticated user
  fastify.post('/:id/claim', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;

    try {
      const userAirdrop = await prisma.userAirdrop.findUnique({
        where: {
          userId_airdropId: {
            userId: userId,
            airdropId: id,
          },
        },
      });

      if (!userAirdrop) {
        reply.code(404).send({ error: 'User airdrop not found' });
        return;
      }

      const newStatus = userAirdrop.status === 'claimed' ? 'eligible' : 'claimed';
      const updatedAirdrop = await prisma.userAirdrop.update({
        where: {
          userId_airdropId: {
            userId: userId,
            airdropId: id,
          },
        },
        data: {
          status: newStatus,
          claimedAt: newStatus === 'claimed' ? new Date() : null,
        },
        include: {
          airdrop: true,
        },
      });

      return { airdrop: updatedAirdrop };
    } catch (error) {
      console.error('Error toggling airdrop claim status:', error);
      reply.code(500).send({ error: 'Failed to toggle airdrop claim status' });
    }
  });

  // Create airdrop
  fastify.post('/', async (request, reply) => {
    const { title, description, criteria, deadline } = request.body as {
      title: string;
      description?: string;
      criteria: string;
      deadline: string;
    };
    
    try {
      const airdrop = await prisma.airdrop.create({
        data: {
          title,
          description,
          criteria,
          deadline: new Date(deadline)
        }
      });
      
      reply.code(201).send({ airdrop });
    } catch (error) {
      console.error('Error creating airdrop:', error);
      throw new Error('Failed to create airdrop');
    }
  });

  // Update airdrop
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, description, criteria, deadline } = request.body as { 
      title?: string; 
      description?: string; 
      criteria?: string; 
      deadline?: string;
    };
    
    try {
      const airdrop = await prisma.airdrop.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(criteria && { criteria }),
          ...(deadline && { deadline: new Date(deadline) })
        }
      });
      
      return { airdrop };
    } catch (error) {
      console.error('Error updating airdrop:', error);
      throw new Error('Failed to update airdrop');
    }
  });

  // Delete airdrop
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      await prisma.airdrop.delete({
        where: { id }
      });
      
      reply.code(204).send();
    } catch (error) {
      console.error('Error deleting airdrop:', error);
      throw new Error('Failed to delete airdrop');
    }
  });

  // Get users eligible for an airdrop
  fastify.get('/:id/users', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const userAirdrops = await prisma.userAirdrop.findMany({
        where: { airdropId: id },
        include: {
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });
      
      return { users: userAirdrops };
    } catch (error) {
      console.error('Error fetching airdrop users:', error);
      throw new Error('Failed to fetch airdrop users');
    }
  });

  // Add user to airdrop
  fastify.post('/:id/users', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, status } = request.body as { userId: string; status: string };
    
    try {
      const userAirdrop = await prisma.userAirdrop.create({
        data: {
          userId,
          airdropId: id,
          status
        },
        include: {
          user: {
            select: {
              id: true,
              email: true
            }
          },
          airdrop: true
        }
      });
      
      reply.code(201).send({ userAirdrop });
    } catch (error) {
      console.error('Error adding user to airdrop:', error);
      throw new Error('Failed to add user to airdrop');
    }
  });

  // Update user airdrop status
  fastify.put('/:id/users/:userId', async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const { status } = request.body as { status: string };
    
    try {
      const userAirdrop = await prisma.userAirdrop.update({
        where: {
          userId_airdropId: {
            userId,
            airdropId: id
          }
        },
        data: {
          status,
          ...(status === 'claimed' && { claimedAt: new Date() })
        },
        include: {
          user: {
            select: {
              id: true,
              email: true
            }
          },
          airdrop: true
        }
      });
      
      return { userAirdrop };
    } catch (error) {
      console.error('Error updating user airdrop status:', error);
      throw new Error('Failed to update user airdrop status');
    }
  });
}