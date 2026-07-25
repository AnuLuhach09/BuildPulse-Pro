import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Prisma Client Singleton
 *
 * WHY singleton: In development, Next.js/ts-node hot reload creates
 * new module instances, which would open multiple DB connections.
 * By storing the instance on globalThis (which survives hot reloads),
 * we guarantee a single connection pool regardless of reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
