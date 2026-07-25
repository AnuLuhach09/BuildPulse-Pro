import 'dotenv/config';
import { z } from 'zod';

/**
 * Validated environment configuration using Zod.
 *
 * WHY: Raw process.env values are all strings and unvalidated.
 * By parsing them through Zod at startup, we fail fast if any
 * required variable is missing or has the wrong type — before
 * serving any requests. This prevents hard-to-debug runtime errors.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_VERSION: z.string().default('v1'),
  FRONTEND_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1, 'GITHUB_WEBHOOK_SECRET is required'),
  GITHUB_APP_TOKEN: z.string().optional(),

  // Groq AI
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_BASE_URL: z.string().default('https://api.groq.com/openai/v1'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().transform((v) => v === 'true').default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('BuildPulse Pro <noreply@buildpulse.io>'),

  // Slack
  SLACK_DEFAULT_WEBHOOK_URL: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
