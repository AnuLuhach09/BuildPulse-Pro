import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from './auth.middleware';
import { validate } from '../../shared/middleware/validateRequest';
import { authRateLimiter } from '../../shared/middleware/rateLimiter';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
} from './auth.schemas';

const router = Router();

/**
 * Auth Routes
 *
 * DESIGN: Route definitions are declarative — read them top to bottom
 * and you understand exactly what middleware runs on each endpoint.
 * No hidden logic in controllers.
 */

// ── Public routes (no auth required) ────────────────────────────────────────
router.post(
  '/register',
  authRateLimiter,
  validate(RegisterSchema),
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  validate(LoginSchema),
  authController.login
);

router.post(
  '/refresh',
  authController.refresh  // Schema validation done inside controller (cookie or body)
);

// ── GitHub OAuth ─────────────────────────────────────────────────────────────
router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  if (!clientId || clientId === 'your-github-oauth-app-client-id') {
    res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
    return;
  }

  // Redirect to GitHub with OAuth params
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: process.env.GITHUB_CALLBACK_URL ?? '',
    scope: 'read:user user:email repo',
    state: Math.random().toString(36).substring(7),
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/github/callback', authController.githubCallback);

// ── Protected routes (auth required) ─────────────────────────────────────────
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
