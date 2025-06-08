import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '../generated/prisma';

// Define role hierarchy
const roleHierarchy: { [key in UserRole]: UserRole[] } = {
  ADMIN: ['ADMIN', 'MODERATOR', 'USER'],
  MODERATOR: ['MODERATOR', 'USER'],
  USER: ['USER']
};

// Check if a role has permission over another role
function hasRolePermission(requiredRole: UserRole, userRole: UserRole): boolean {
  return roleHierarchy[userRole]?.includes(requiredRole) || false;
}

// Middleware to check if user has required role
export function requireRole(requiredRole: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: UserRole } | undefined;

      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      if (!hasRolePermission(requiredRole, user.role)) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }
    } catch (error) {
      console.error('Role verification error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

// Helper function to require multiple roles (any of them)
export function requireAnyRole(roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: UserRole } | undefined;

      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const hasPermission = roles.some(role => hasRolePermission(role, user.role));
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }
    } catch (error) {
      console.error('Role verification error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

// Helper function to check if user has specific role
export function hasRole(user: { role: UserRole }, requiredRole: UserRole): boolean {
  return hasRolePermission(requiredRole, user.role);
}
