import { PrismaClient } from '../generated/prisma';

// Create a singleton instance of the PrismaClient
const prisma = new PrismaClient();

export default prisma;