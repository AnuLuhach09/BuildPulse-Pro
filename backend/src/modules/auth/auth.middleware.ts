import { Request, Response, NextFunction } from 'express';
import { jwt_util, AccessTokenPayload } from '../../shared/utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError';
import { Role } from '@prisma/client';

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * JWT Authentication Middleware
 *
 * WHY Bearer token in Authorization header (not cookies):
 * - Cookies require CSRF protection for browser clients
 * - Bearer tokens work natively with mobile apps and third-party clients
 * - We handle refresh token rotation explicitly via /auth/refresh endpoint
 *
 * NOTE: The refresh token should be stored in an httpOnly cookie
 * on the client to prevent XSS access.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;

  if (apiKey) {
    try {
      const { keysService } = await import('../keys/keys.service');
      const user = await keysService.validateKey(apiKey);
      req.user = {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
      };
      return next();
    } catch (err) {
      return next(err);
    }
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(UnauthorizedError('Authorization header missing or malformed'));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(UnauthorizedError('Bearer token not provided'));
  }

  try {
    const payload = jwt_util.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-based authorization middleware factory.
 *
 * WHY factory pattern: Lets us compose authorization as:
 *   router.delete('/:id', authenticate, authorize('ADMIN'), controller.delete)
 *
 * This is more readable than inline if-checks in controllers.
 */
export const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(UnauthorizedError('Not authenticated'));
    }

    if (!roles.includes(req.user.role as Role)) {
      return next(
        ForbiddenError(`This action requires one of: ${roles.join(', ')} role`)
      );
    }

    next();
  };
};
