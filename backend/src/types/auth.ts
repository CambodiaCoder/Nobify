import { UserRole } from '../generated/prisma';

export interface JWTPayload {
  userId: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}
