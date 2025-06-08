import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAuthToken(fastify: any, userId: string): string {
  return fastify.jwt.sign({ userId }, {
    expiresIn: '1h' // Token expires in 1 hour
  });
}

export function generateRefreshToken(fastify: any, userId: string): string {
  return fastify.jwt.sign({ userId, type: 'refresh' }, {
    expiresIn: '7d' // Refresh token expires in 7 days
  });
}
