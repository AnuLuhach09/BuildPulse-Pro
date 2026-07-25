import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../../config/redis';
import { env } from '../../config/env';

// Shared Redis store for distributed multi-instance rate limiting
const rateLimitStore = new RedisStore({
  // @ts-expect-error - sendCommand signature dynamic mapping
  sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
});

/**
 * Standard API rate limiter.
 *
 * WHY rate limiting: Prevents brute-force attacks, API abuse, and
 * unintentional DoS from misbehaving clients. Using RedisStore
 * ensures limits are synchronized across multiple backend instances.
 */
export const apiRateLimiter = rateLimit({
  store: rateLimitStore,
  windowMs: env.RATE_LIMIT_WINDOW_MS,  // 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS,    // 100 requests per window
  standardHeaders: true,               // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,                // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
  skip: (req) => env.NODE_ENV === 'test', // Skip in tests
});

/**
 * Stricter limiter for auth endpoints (login, register).
 *
 * WHY separate auth limiter: Brute-forcing passwords requires many
 * attempts. A 10-request limit over 15 minutes stops automated attacks
 * without affecting legitimate users.
 */
export const authRateLimiter = rateLimit({
  store: rateLimitStore,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please wait 15 minutes.',
    },
  },
  skip: (req) => env.NODE_ENV === 'test',
});

/**
 * Webhook-specific: no rate limit (GitHub sends events at its own pace),
 * but we verify HMAC before processing anything.
 */
export const webhookRateLimiter = rateLimit({
  store: rateLimitStore,
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => env.NODE_ENV === 'test',
});
