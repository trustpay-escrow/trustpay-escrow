import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { logger } from '../shared/utils/logger.js';
import { env } from './env.js';

const connectionString =
  env.databaseUrl || 'postgresql://postgres:postgres@localhost:5432/postgres';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Prevent multiple PrismaClient instances during dev reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Health check helper to verify database connectivity via Prisma
 */
export async function checkPrismaConnection(): Promise<boolean> {
  try {
    if (!env.databaseUrl) {
      return false;
    }
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.warn('Prisma database connection check warning:', error);
    return false;
  }
}

/**
 * Graceful shutdown helper
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    await pool.end();
    logger.info('Prisma client and connection pool disconnected successfully.');
  } catch (error) {
    logger.error('Error disconnecting Prisma client:', error);
  }
}

export default prisma;
