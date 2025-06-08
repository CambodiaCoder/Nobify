import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hashPassword, verifyPassword, generateAuthToken, generateRefreshToken } from '../lib/auth';
import { checkLoginThrottle, recordLoginAttempt, cleanupOldAttempts } from '../lib/loginSecurity';
import prisma from '../lib/prisma';
import { signupSchema, loginSchema, refreshTokenSchema, logoutSchema } from '../schemas/auth';

export default async function (fastify: FastifyInstance) {
  // Signup endpoint
  fastify.post('/signup', {
    schema: signupSchema
  }, async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
    const { email, password } = request.body;

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        reply.code(400).send({ error: 'Email already registered' });
        return;
      }

      // Hash password and create user with default USER role
      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          role: 'USER'
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true
        }
      });

      // Generate tokens
      const authToken = generateAuthToken(fastify, user.id);
      const refreshToken = generateRefreshToken(fastify, user.id);

      // Store refresh token in database with expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt
        }
      });

      reply.code(201).send({
        user,
        tokens: {
          accessToken: authToken,
          refreshToken,
          expiresIn: 3600 // 1 hour in seconds
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Login endpoint
  fastify.post('/login', {
    schema: loginSchema
  }, async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
    const { email, password } = request.body;

    try {
      // Get IP address from request
      const ipAddress = request.ip;

      // Check for too many failed attempts
      const canProceed = await checkLoginThrottle(email, ipAddress, reply);
      if (!canProceed) {
        return;
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email }
      });

      // Record the attempt regardless of success
      const attemptData = {
        email,
        ipAddress,
        success: false,
        userId: user?.id
      };

      if (!user) {
        await recordLoginAttempt(attemptData);
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }

      // Verify password
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        await recordLoginAttempt(attemptData);
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }

      // Update attempt as successful
      await recordLoginAttempt({
        ...attemptData,
        success: true
      });

      // Clean up old attempts periodically (1% chance)
      if (Math.random() < 0.01) {
        cleanupOldAttempts().catch(console.error);
      }

      // Generate tokens
      const authToken = generateAuthToken(fastify, user.id);
      const refreshToken = generateRefreshToken(fastify, user.id);

      // Store refresh token in database with expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt
        }
      });

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        },
        tokens: {
          accessToken: authToken,
          refreshToken,
          expiresIn: 3600 // 1 hour in seconds
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Refresh token endpoint
  fastify.post('/refresh-token', {
    schema: refreshTokenSchema
  }, async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    const { refreshToken } = request.body;

    try {
      // Verify refresh token
      const decoded = fastify.jwt.verify<{ userId: string; type: string }>(refreshToken);
      
      if (decoded.type !== 'refresh') {
        reply.code(401).send({ error: 'Invalid refresh token' });
        return;
      }

      // Check if refresh token exists and is not expired
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        // Delete expired token if it exists
        if (storedToken) {
          await prisma.refreshToken.delete({
            where: { token: refreshToken }
          });
        }
        reply.code(401).send({ error: 'Invalid or expired refresh token' });
        return;
      }

      // Generate new tokens
      const newAuthToken = generateAuthToken(fastify, decoded.userId);
      const newRefreshToken = generateRefreshToken(fastify, decoded.userId);

      // Replace old refresh token with new one
      await prisma.refreshToken.delete({
        where: { token: refreshToken }
      });

      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 days from now

      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: decoded.userId,
          expiresAt: newExpiresAt
        }
      });

      reply.send({
        tokens: {
          accessToken: newAuthToken,
          refreshToken: newRefreshToken,
          expiresIn: 3600 // 1 hour in seconds
        }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });

  // Logout endpoint
  fastify.post('/logout', {
    schema: logoutSchema
  }, async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    const { refreshToken } = request.body;

    try {
      // Remove refresh token from database
      // Use deleteMany to avoid throwing an error if the token is not found
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });

      reply.code(200).send({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
