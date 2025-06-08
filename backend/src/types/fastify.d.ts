import '@fastify/jwt'

interface User {
  id: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: User;
    payload: {
      userId: string;
      type?: string;
    };
  }
}
