import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';

export interface AccessTokenPayload {
  sub: string;    // user id
  email: string;
  role: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;    // user id
  jti: string;    // refresh token id (for rotation tracking)
  type: 'refresh';
}

/**
 * JWT Utility
 *
 * WHY separate access/refresh secrets: If the refresh secret leaks,
 * attackers can mint long-lived refresh tokens. If the access secret
 * leaks, they can only mint short-lived (15min) access tokens.
 * Two secrets limit the blast radius of a single secret compromise.
 *
 * WHY jti (JWT ID) on refresh tokens: We store refresh token IDs in the DB.
 * On rotation, we invalidate the old jti. This enables:
 * - Logout from all devices
 * - Detection of stolen token reuse (if old jti is used after rotation)
 */
export const jwt_util = {
  signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );
  },

  signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'refresh' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );
  },

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
      if (decoded.type !== 'access') {
        throw new AppError('Invalid token type', 401, 'INVALID_TOKEN');
      }
      return decoded;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Access token expired', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
    }
  },

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 401, 'INVALID_TOKEN');
      }
      return decoded;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Refresh token expired. Please log in again.', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }
  },
};
