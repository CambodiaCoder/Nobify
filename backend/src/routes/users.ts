import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '../generated/prisma';

interface RequestParams {
  id: string;
}

interface RequestBody {
  email: string;
}

interface IRequest extends FastifyRequest {
  params: RequestParams;
  body: RequestBody;
}

export default async function (fastify: FastifyInstance) {
  // Get all users (admin only)
  fastify.get('/', { 
    preHandler: [requireAuth, requireRole(UserRole.ADMIN)]
  }, async (request: FastifyRequest) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return { users };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  });

  // Get current authenticated user's profile
  fastify.get('/me', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const currentUser = request.user as { id: string; role: UserRole };

    try {
      const user = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: {
          id: true,
          email: true,
          name: true,
          profileImage: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      return { user };
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw new Error('Failed to fetch current user');
    }
  });

  // Get user by ID (admin or self)
  fastify.get<{ Params: RequestParams }>('/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest<{ Params: RequestParams }>, reply: FastifyReply) => {
    const { id } = request.params;
    const currentUser = request.user as { id: string; role: UserRole };

    // Allow access if user is admin or accessing their own profile
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
      reply.code(403).send({ error: 'Forbidden: Cannot view other users' });
      return;
    }
    
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          profileImage: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      if (!user) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }
      
      return { user };
    } catch (error) {
      console.error('Error fetching user:', error);
      throw new Error('Failed to fetch user');
    }
  });

  // Update user (protected route)
  fastify.put<{ Params: RequestParams; Body: RequestBody }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: RequestParams; Body: RequestBody }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    // Ensure users can only update their own profile
    if ((request.user as { id: string }).id !== id) {
      reply.code(403).send({ error: 'Forbidden: Cannot update other users' });
      return;
    }

    const { email } = request.body;
    
    try {
      const user = await prisma.user.update({
        where: { id },
        data: { email },
        select: {
          id: true,
          email: true,
          name: true,
          profileImage: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      return { user };
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  });

  // Delete user (protected route)
  fastify.delete<{ Params: RequestParams }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: RequestParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Ensure users can only delete their own profile
    if ((request.user as { id: string }).id !== id) {
      reply.code(403).send({ error: 'Forbidden: Cannot delete other users' });
      return;
    }
    
    try {
      await prisma.user.delete({
        where: { id }
      });
      
      reply.code(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  });
  // Get public user profile by ID
  fastify.get<{ Params: RequestParams }>('/public/:id', async (request: FastifyRequest<{ Params: RequestParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          profileImage: true,
        }
      });

      if (!user) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      return { user };
    } catch (error) {
      console.error('Error fetching public user profile:', error);
      throw new Error('Failed to fetch public user profile');
    }
  });
}
