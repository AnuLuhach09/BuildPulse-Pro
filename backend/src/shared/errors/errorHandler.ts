import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

/**
 * Global Express error handler.
 *
 * PLACEMENT: Must be the LAST middleware registered in app.ts.
 * Express identifies error handlers by their 4-parameter signature (err, req, res, next).
 *
 * STRATEGY:
 * 1. Normalize known error types (Prisma, Zod, JWT) into AppError
 * 2. Log all errors with appropriate severity
 * 3. Send safe, consistent JSON response — never expose internals in production
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // ── Normalize to AppError ────────────────────────────────────────────────
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    // Zod validation failures — extract human-readable field errors
    const firstIssue = err.issues[0];
    appError = new AppError(
      `Validation failed: ${firstIssue.path.join('.')} — ${firstIssue.message}`,
      422,
      'VALIDATION_ERROR'
    );
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma-specific errors: unique constraint, not found, etc.
    appError = handlePrismaError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    appError = new AppError('Database validation failed', 400, 'DB_VALIDATION_ERROR');
  } else if (err instanceof Error) {
    // Unknown programmer error — log fully, expose minimally
    appError = new AppError(
      env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      500,
      'INTERNAL_ERROR'
    );
    appError.isOperational && logger.error('[ErrorHandler] Unhandled Error', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
    });
  } else {
    appError = new AppError('An unexpected error occurred', 500, 'INTERNAL_ERROR');
  }

  // ── Log ─────────────────────────────────────────────────────────────────
  if (appError.statusCode >= 500) {
    logger.error('[ErrorHandler]', {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      url: req.url,
      method: req.method,
      stack: appError.stack,
    });
  } else {
    logger.warn('[ErrorHandler]', {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      url: req.url,
    });
  }

  // ── Respond ──────────────────────────────────────────────────────────────
  const body: ErrorResponse = {
    success: false,
    error: {
      code: appError.code ?? 'ERROR',
      message: appError.message,
      ...(env.NODE_ENV !== 'production' && { stack: appError.stack }),
    },
  };

  res.status(appError.statusCode).json(body);
};

// ── Prisma Error Mapping ─────────────────────────────────────────────────────
function handlePrismaError(err: Prisma.PrismaClientKnownRequestError): AppError {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint violation
      const field = (err.meta?.target as string[])?.join(', ') ?? 'field';
      return new AppError(`A record with this ${field} already exists`, 409, 'CONFLICT');
    }
    case 'P2025':
      return new AppError('Record not found', 404, 'NOT_FOUND');
    case 'P2003':
      return new AppError('Related record not found', 404, 'RELATED_NOT_FOUND');
    case 'P2014':
      return new AppError('Invalid relation data', 400, 'INVALID_RELATION');
    default:
      return new AppError('Database operation failed', 500, 'DB_ERROR');
  }
}
