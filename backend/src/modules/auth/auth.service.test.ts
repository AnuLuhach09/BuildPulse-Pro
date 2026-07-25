import { AuthService } from './auth.service';
import prisma from '../../config/database';
import bcrypt from 'bcryptjs';
import { jwt_util } from '../../shared/utils/jwt';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../../shared/utils/jwt', () => ({
  jwt_util: {
    signAccessToken: jest.fn(() => 'mock-access-token'),
    signRefreshToken: jest.fn(() => 'mock-refresh-token'),
    verifyRefreshToken: jest.fn(() => ({ sub: 'user-id', jti: 'token-jti', type: 'refresh' })),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictError if user email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-id' });

      await expect(
        authService.register({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('An account with this email already exists');
    });

    it('should hash password and create user if email is available', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'new-id',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'DEVELOPER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await authService.register({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password123!',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(res.tokens.accessToken).toBe('mock-access-token');
      expect(res.tokens.refreshToken).toBe('mock-refresh-token');
    });
  });
});
