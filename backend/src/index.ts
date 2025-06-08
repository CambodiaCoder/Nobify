import 'dotenv/config';
import fastify, { FastifyInstance } from 'fastify';
import prisma from './lib/prisma';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';

// Import route handlers
import userRoutes from './routes/users';
import authRoutes from './routes/auth';
import airdropRoutes from './routes/airdrops';
import portfolioRoutes from './routes/portfolio';
import alertRoutes from './routes/alerts';

// Import scheduler
import { initializeScheduler } from './services/schedulerService';

// Create Fastify server instance
const server: FastifyInstance = fastify({
  logger: true
});

// Register CORS plugin
server.register(fastifyCors, {
  origin: 'http://localhost:5173', // Explicitly allow frontend origin
  credentials: true,
});

// Register fastify-jwt plugin
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  server.log.error('JWT_SECRET is not defined in environment variables. Server cannot start securely.');
  process.exit(1);
}

server.register(fastifyJwt, {
  secret: jwtSecret,
  sign: {
    expiresIn: '1h' // Access tokens expire in 1 hour
  },
  verify: {
    maxAge: '1h' // Verify tokens are not older than 1 hour
  }
});

// Define a test route
server.get('/', async () => {
  return { hello: 'world' };
});

// Global hook to ensure CORS headers are always sent
server.addHook('onSend', (request, reply, payload, done) => {
  reply.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  reply.header('Access-Control-Allow-Credentials', 'true');
  done();
});

// Register route handlers
server.register(authRoutes, { prefix: '/api/auth' });
server.register(userRoutes, { prefix: '/api/users' });
server.register(airdropRoutes, { prefix: '/api/airdrops' });
server.register(portfolioRoutes, { prefix: '/api/portfolio' });
server.register(alertRoutes, { prefix: '/api/alerts' });

// Define server startup function
const start = async () => {
  try {
    // Get port from environment variable or use default
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

    // Start the server
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server is running on port ${port}`);

    // Initialize alert scheduler after server starts
    initializeScheduler();

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  } finally {
    // Close Prisma client on server shutdown
    process.on('beforeExit', async () => {
      await prisma.$disconnect();
    });
  }
};

// Start the server
start();
