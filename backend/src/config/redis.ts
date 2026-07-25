import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Redis client factory.
 *
 * WHY ioredis over `redis` package: ioredis has built-in reconnection
 * logic, cluster support, and is the only client officially supported
 * by BullMQ. Upstash Redis uses standard Redis protocol, so ioredis
 * works with it out of the box — just point REDIS_URL at Upstash.
 */
const createRedisClient = (name: string): Redis => {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,    // Required by BullMQ
    lazyConnect: false,
  });

  client.on('connect', () => logger.info(`[Redis:${name}] Connected`));
  client.on('ready', () => logger.info(`[Redis:${name}] Ready`));
  client.on('error', (err) => logger.error(`[Redis:${name}] Error`, { err }));
  client.on('close', () => logger.warn(`[Redis:${name}] Connection closed`));
  client.on('reconnecting', () => logger.warn(`[Redis:${name}] Reconnecting...`));

  return client;
};

// Main client for general cache operations
export const redis = createRedisClient('main');

/**
 * BullMQ requires separate connection instances for each queue/worker.
 * Call this factory when creating new queues or workers.
 */
export const createBullMQConnection = (): Redis =>
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

export default redis;
