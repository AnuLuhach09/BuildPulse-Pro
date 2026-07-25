import { verifyGithubWebhook } from './webhook.middleware';
import prisma from '../../config/database';
import crypto from 'crypto';
import { Request, Response } from 'express';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    repository: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Webhook Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
    res = {};
    jest.clearAllMocks();
  });

  it('should call next with error if x-hub-signature-256 is missing', async () => {
    req = {
      headers: {
        'x-github-delivery': '123',
        'x-github-event': 'push',
      },
    };

    await verifyGithubWebhook(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.code).toBe('MISSING_SIGNATURE');
  });

  it('should call next with error if signature is invalid', async () => {
    const rawBody = Buffer.from(JSON.stringify({ repository: { full_name: 'test/repo' } }));
    req = {
      headers: {
        'x-hub-signature-256': 'sha256=wrong-sig',
        'x-github-delivery': '123',
        'x-github-event': 'push',
      },
      body: rawBody,
    };

    (prisma.repository.findUnique as jest.Mock).mockResolvedValue({
      id: 'repo-id',
      webhookSecret: 'my-secret',
    });

    await verifyGithubWebhook(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.code).toBe('INVALID_SIGNATURE');
  });

  it('should pass signature verification if signature matches', async () => {
    const payload = { repository: { full_name: 'test/repo' } };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const secret = 'my-secret';
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    req = {
      headers: {
        'x-hub-signature-256': signature,
        'x-github-delivery': '123',
        'x-github-event': 'push',
      },
      body: rawBody,
    };

    (prisma.repository.findUnique as jest.Mock).mockResolvedValue({
      id: 'repo-id',
      webhookSecret: secret,
    });

    await verifyGithubWebhook(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual(payload);
  });
});
