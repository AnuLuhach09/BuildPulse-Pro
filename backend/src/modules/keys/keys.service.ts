import crypto from 'crypto';
import prisma from '../../config/database';
import { NotFoundError, UnauthorizedError } from '../../shared/errors/AppError';
import type { CreateApiKeyDTO } from './keys.schemas';

export class KeysService {
  /**
   * Create a new API Key for a user.
   * Generates a key formatted as: bp_[32_char_hex]
   * Hashed using SHA-256 for secure DB storage.
   */
  async create(userId: string, dto: CreateApiKeyDTO) {
    const rawSecret = crypto.randomBytes(16).toString('hex'); // 32 hex chars
    const prefix = 'bp_';
    const rawKey = `${prefix}${rawSecret}`;

    const keyHash = crypto
      .createHash('sha256')
      .update(rawKey)
      .digest('hex');

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash,
        prefix,
        userId,
        expiresAt,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      rawKey, // Return raw key ONCE so user can copy it
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * List all keys for a user (with keyHash and secrets masked).
   */
  async list(userId: string) {
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return keys.map((k) => ({
      ...k,
      maskedKey: `${k.prefix}••••••••••••••••`,
    }));
  }

  /**
   * Revoke an API Key.
   */
  async revoke(id: string, userId: string) {
    const key = await prisma.apiKey.findFirst({
      where: { id, userId },
    });
    if (!key) throw NotFoundError('API Key');

    await prisma.apiKey.delete({ where: { id } });
    return { message: 'API Key successfully revoked' };
  }

  /**
   * Validate an API key raw token.
   * Returns the user associated with it if valid and active.
   */
  async validateKey(rawKey: string) {
    if (!rawKey.startsWith('bp_')) {
      throw UnauthorizedError('Invalid API Key format');
    }

    const keyHash = crypto
      .createHash('sha256')
      .update(rawKey)
      .digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!apiKey) {
      throw UnauthorizedError('API Key not found or invalid');
    }

    if (!apiKey.user.isActive) {
      throw UnauthorizedError('User account is deactivated');
    }

    if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
      throw UnauthorizedError('API Key has expired');
    }

    return apiKey.user;
  }
}

export const keysService = new KeysService();
