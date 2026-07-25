import winston from 'winston';
import { env } from './env';

/**
 * Structured logger using Winston.
 *
 * WHY structured logging: JSON logs can be ingested by log aggregators
 * (Datadog, Logtail, CloudWatch) and searched/filtered. Plain console.log
 * is unstructured and unindexable in production.
 *
 * WHY Winston over Pino: Winston has better transport ecosystem for our
 * use case (file + console + potential CloudWatch transport).
 */
const { combine, timestamp, json, colorize, printf } = winston.format;

// Human-readable format for development
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// Machine-readable JSON for production
const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'buildpulse-api' },
  transports: [
    new winston.transports.Console(),
    // In production, add file or CloudWatch transports here
  ],
});

export default logger;
