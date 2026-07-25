import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { jwt_util } from '../../shared/utils/jwt';
import { AppError, ConflictError, UnauthorizedError } from '../../shared/errors/AppError';
import { env } from '../../config/env';
import type { RegisterDTO, LoginDTO } from './auth.schemas';
import type { User } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

// User shape safe to return to client (no passwordHash)
type SafeUser = Omit<User, 'passwordHash'>;

/**
 * Auth Service
 *
 * WHY service layer: Controllers handle HTTP concerns (req/res),
 * services handle business logic. This separation means:
 * - Services are testable without HTTP context
 * - Same logic can be reused (OAuth callback uses same token generation)
 * - Clear boundary for what each layer is responsible for
 */
export class AuthService {
  /**
   * Register a new user with email + password.
   * Hashes password with bcrypt (cost factor 12 — ~250ms, brute-force resistant).
   */
  async register(dto: RegisterDTO): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw ConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        // Create default notification preferences
        notifications: {
          create: {
            emailEnabled: true,
            onFailure: true,
          },
        },
      },
    });

    const tokens = await this.generateTokenPair(user);
    const { passwordHash: _, ...safeUser } = user;

    return { user: safeUser, tokens };
  }

  /**
   * Login with email + password.
   *
   * WHY same error for "not found" and "wrong password":
   * Returning different messages leaks whether the email exists in
   * our system (user enumeration attack). Generic message prevents this.
   */
  async login(dto: LoginDTO): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    const GENERIC_ERROR = 'Invalid email or password';

    if (!user) throw new AppError(GENERIC_ERROR, 401, 'INVALID_CREDENTIALS');
    if (!user.passwordHash) {
      // GitHub OAuth user trying to log in with password
      throw new AppError('This account uses GitHub login. Please sign in with GitHub.', 401, 'OAUTH_ONLY');
    }
    if (!user.isActive) throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) throw new AppError(GENERIC_ERROR, 401, 'INVALID_CREDENTIALS');

    const tokens = await this.generateTokenPair(user);
    const { passwordHash: _, ...safeUser } = user;

    return { user: safeUser, tokens };
  }

  /**
   * Rotate refresh token (token rotation strategy).
   *
   * WHY rotation: After each use, the old refresh token is deleted and a
   * new one is issued. If a stolen token is replayed after rotation,
   * the jti won't exist in DB → automatic rejection.
   * If an attacker uses the old token first, the legitimate user's next
   * refresh will also fail, alerting them to the compromise.
   */
  async refresh(token: string): Promise<AuthTokens> {
    const payload = jwt_util.verifyRefreshToken(token);

    // Check DB for this refresh token (jti = token id = uuid stored in DB record)
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw UnauthorizedError('Invalid or expired refresh token. Please log in again.');
    }

    if (!storedToken.user.isActive) {
      throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Atomic: delete old token + create new one in a transaction
    const [, newTokens] = await prisma.$transaction(async (tx) => {
      const deleted = await tx.refreshToken.delete({ where: { token } });
      const tokens = await this.generateTokenPair(storedToken.user, tx as typeof prisma);
      return [deleted, tokens];
    });

    return newTokens;
  }

  /**
   * Logout: invalidate refresh token from DB.
   */
  async logout(token: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }

  /**
   * Find or create a user from GitHub OAuth data.
   * Used in the OAuth callback.
   */
  async findOrCreateGithubUser(profile: {
    id: string;
    login: string;
    email?: string;
    name?: string;
    avatar_url?: string;
  }): Promise<AuthResponse> {
    // Try to find by GitHub ID first
    let user = await prisma.user.findUnique({
      where: { githubId: profile.id },
    });

    if (!user && profile.email) {
      // If GitHub account has an email, try to link to existing account
      const existingByEmail = await prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { githubId: profile.id, githubLogin: profile.login, avatarUrl: profile.avatar_url },
        });
      }
    }

    if (!user) {
      // Create new user from GitHub profile
      user = await prisma.user.create({
        data: {
          githubId: profile.id,
          githubLogin: profile.login,
          email: profile.email ?? `${profile.login}@github.placeholder`,
          name: profile.name ?? profile.login,
          avatarUrl: profile.avatar_url,
          notifications: { create: { emailEnabled: false, onFailure: true } },
        },
      });
    }

    const tokens = await this.generateTokenPair(user);
    const { passwordHash: _, ...safeUser } = user;

    return { user: safeUser, tokens };
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private async generateTokenPair(
    user: User,
    db: typeof prisma = prisma
  ): Promise<AuthTokens> {
    const jti = uuidv4();

    const accessToken = jwt_util.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = jwt_util.signRefreshToken({
      sub: user.id,
      jti,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await db.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
