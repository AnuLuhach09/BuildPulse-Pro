import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './shared/errors/errorHandler';
import { apiRateLimiter } from './shared/middleware/rateLimiter';
import { auditLogger } from './shared/middleware/auditLogger';

import authRoutes from './modules/auth/auth.routes';
import repoRoutes from './modules/repositories/repositories.routes';
import pipelineRoutes from './modules/pipelines/pipelines.routes';
import webhookRoutes from './modules/webhooks/webhooks.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import userRoutes from './modules/users/users.routes';
import adminRoutes from './modules/admin/admin.routes';
import keysRoutes from './modules/keys/keys.routes';
import prisma from './config/database';
import { redis } from './config/redis';

/**
 * Express Application Factory
 *
 * WHY factory function (not direct app export):
 * - Testing: each test creates a fresh app instance, no state leaks
 * - Flexibility: can create multiple app instances with different configs
 * - server.ts owns the HTTP server; app.ts owns middleware + routing
 */
export const createApp = (): Application => {
  const app = express();

  // ── Security Headers ─────────────────────────────────────────────────────
  // Helmet sets 15+ security headers (XSS protection, HSTS, CSP, etc.)
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // Required for PDF.js
  }));

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, callback) => {
      const allowed = [env.FRONTEND_URL, 'http://localhost:3000'];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true, // Required for cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ── Body Parsing ──────────────────────────────────────────────────────────
  // Raw body needed for HMAC webhook signature verification
  app.use(`/api/${env.API_VERSION}/webhooks/github`, express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // ── Compression ───────────────────────────────────────────────────────────
  app.use(compression());

  // ── Request Logging ───────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(
      morgan('combined', {
        stream: { write: (msg) => logger.info(msg.trim()) },
      })
    );
  }

  // ── Global Rate Limiting ──────────────────────────────────────────────────
  app.use('/api', apiRateLimiter);

  // ── Audit Logging ─────────────────────────────────────────────────────────
  app.use('/api', auditLogger);

  // ── Health Check ─────────────────────────────────────────────────────────
  const healthHandler = async (_req: Request, res: Response) => {
    let dbStatus = 'connected';
    let redisStatus = 'connected';
    let groqStatus = 'configured';

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      dbStatus = 'disconnected';
    }

    try {
      await redis.ping();
    } catch (e) {
      redisStatus = 'disconnected';
    }

    if (!env.GROQ_API_KEY || env.GROQ_API_KEY.includes('placeholder')) {
      groqStatus = 'not_configured';
    }

    const overallStatus = dbStatus === 'connected' && redisStatus === 'connected' ? 'ok' : 'degraded';

    res.status(200).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      environment: env.NODE_ENV,
      services: {
        database: dbStatus,
        redis: redisStatus,
        ai: groqStatus,
      }
    });
  };

  app.get('/health', healthHandler);
  app.get(`/api/${env.API_VERSION}/health`, healthHandler);

  // ── API Routes ────────────────────────────────────────────────────────────
  const apiPrefix = `/api/${env.API_VERSION}`;

  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/repos`, repoRoutes);
  app.use(`${apiPrefix}/pipelines`, pipelineRoutes);
  app.use(`${apiPrefix}/webhooks`, webhookRoutes);
  app.use(`${apiPrefix}/analytics`, analyticsRoutes);
  app.use(`${apiPrefix}/users`, userRoutes);
  app.use(`${apiPrefix}/admin`, adminRoutes);
  app.use(`${apiPrefix}/keys`, keysRoutes);
  // app.use(`${apiPrefix}/admin`, adminRoutes);
  // app.use(`${apiPrefix}/exports`, exportRoutes);

  // ── 404 Handler ───────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
    });
  });

  // ── Global Error Handler ─────────────────────────────────────────────────
  // MUST be last middleware — 4 params identifies it as error handler
  app.use(errorHandler);

  return app;
};
