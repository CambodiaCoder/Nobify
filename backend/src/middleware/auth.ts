import { FastifyRequest, FastifyReply } from 'fastify';
import { FastifyInstance } from 'fastify';

import prisma from '../lib/prisma';
import { UserRole } from '../generated/prisma';

interface JWTPayload {
  userId: string;
  type?: string;
  iat?: number;
  exp?: number;
}

interface AuthUser {
  id: string;
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: AuthUser;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}

export const createAuthMiddleware = (fastify: FastifyInstance) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        reply.code(401).send({ error: 'No token provided' });
        return;
      }

      const decoded = fastify.jwt.verify<JWTPayload>(token);
      
      // Fetch user with role
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true }
      });

      if (!user) {
        reply.code(401).send({ error: 'User not found' });
        return;
      }

      request.user = user;
      
    } catch (error) {
      reply.code(401).send({ error: 'Invalid token' });
    }
  };
};

// Helper function to protect routes
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = await request.jwtVerify<JWTPayload>();
    
    // Fetch user with role
    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      select: { id: true, role: true }
    });

    if (!user) {
      reply.code(401).send({ error: 'User not found' });
      return;
    }

    request.user = user;
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
};
