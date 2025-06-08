import prisma from './prisma';
import { FastifyReply } from 'fastify';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

export interface LoginAttemptData {
  email: string;
  ipAddress: string;
  success: boolean;
  userId?: string;
}

export async function recordLoginAttempt(data: LoginAttemptData) {
  return prisma.loginAttempt.create({
    data: {
      email: data.email,
      ipAddress: data.ipAddress,
      success: data.success,
      userId: data.userId
    }
  });
}

export async function checkLoginThrottle(email: string, ipAddress: string, reply: FastifyReply): Promise<boolean> {
  const timeWindow = new Date(Date.now() - LOCKOUT_DURATION);

  // Count failed attempts within time window for both email and IP
  const [emailAttempts, ipAttempts] = await Promise.all([
    prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: {
          gte: timeWindow
        }
      }
    }),
    prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: {
          gte: timeWindow
        }
      }
    })
  ]);

  if (emailAttempts >= MAX_FAILED_ATTEMPTS) {
    const minutesLeft = Math.ceil(LOCKOUT_DURATION / 60000);
    reply.code(429).send({
      error: `Too many failed login attempts. Please try again in ${minutesLeft} minutes.`
    });
    return false;
  }

  if (ipAttempts >= MAX_FAILED_ATTEMPTS * 2) {
    const minutesLeft = Math.ceil(LOCKOUT_DURATION / 60000);
    reply.code(429).send({
      error: `Too many failed login attempts from this IP. Please try again in ${minutesLeft} minutes.`
    });
    return false;
  }

  return true;
}

export async function cleanupOldAttempts() {
  const cutoffDate = new Date(Date.now() - LOCKOUT_DURATION * 2);
  await prisma.loginAttempt.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    }
  });
}
