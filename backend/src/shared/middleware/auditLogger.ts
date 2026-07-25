import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { logger } from '../../config/logger';

/**
 * Audit Logger Middleware
 *
 * WHY audit logging: In a multi-tenant CI/CD platform, knowing WHO did WHAT
 * and WHEN is critical for security investigations, compliance (SOC2), and
 * debugging data corruption issues. This middleware automatically records
 * all mutating actions (POST, PUT, PATCH, DELETE) to the AuditLog table.
 *
 * DESIGN: We use "fire and forget" here (no await) so audit logging never
 * blocks the response. We catch and log failures separately.
 */
export const auditLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Only audit mutating operations
  const AUDITED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!AUDITED_METHODS.includes(req.method)) {
    return next();
  }

  // Capture response finish to get status code and entity info
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    // Skip failed requests (4xx/5xx don't need audit trails for reads)
    if (res.statusCode < 400) {
      const userId = (req as any).user?.id;
      const parts = req.path.split('/').filter(Boolean);
      const entity = parts[0] ?? 'unknown';
      const entityId = parts[1] ?? undefined;

      // Fire and forget — never block the response
      prisma.auditLog
        .create({
          data: {
            userId: userId ?? null,
            action: req.method,
            entity,
            entityId,
            metadata: {
              path: req.path,
              query: req.query,
              statusCode: res.statusCode,
            },
            ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
          },
        })
        .catch((err) =>
          logger.error('[AuditLogger] Failed to write audit log', { err })
        );
    }

    return originalJson(body);
  };

  next();
};
