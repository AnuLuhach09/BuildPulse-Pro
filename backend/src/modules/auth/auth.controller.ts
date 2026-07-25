import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { asyncHandler } from '../../shared/middleware/validateRequest';
import axios from 'axios';

/**
 * Auth Controller
 *
 * RESPONSIBILITY: HTTP only — extract from req, call service, format res.
 * No business logic lives here. Controllers are intentionally thin.
 *
 * WHY this separation matters: If you want to add a CLI command that
 * registers a user, you call authService.register() directly —
 * no HTTP context needed.
 */
export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: result,
    });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);

    // Set refresh token as httpOnly cookie (XSS protection)
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    // Accept from cookie OR body (supports both browser and API clients)
    const token = req.cookies?.refreshToken ?? req.body?.refreshToken;

    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Refresh token required' },
      });
      return;
    }

    const tokens = await authService.refresh(token);

    // Rotate the httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      data: { accessToken: tokens.accessToken },
    });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken ?? req.body?.refreshToken;

    if (token) {
      await authService.logout(token);
    }

    res.clearCookie('refreshToken');
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    // req.user is set by authenticate middleware
    res.status(200).json({
      success: true,
      data: req.user,
    });
  }),

  // GitHub OAuth handlers
  githubCallback: asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    if (!code) {
      res.redirect(`${frontendUrl}/login?error=oauth_code_missing`);
      return;
    }

    try {
      // 1. Exchange OAuth code for GitHub Access Token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: process.env.GITHUB_CALLBACK_URL,
        },
        {
          headers: {
            Accept: 'application/json',
          },
          timeout: 5000,
        }
      );

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new Error('Failed to retrieve access token from GitHub');
      }

      // 2. Fetch GitHub User Profile
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${accessToken}`,
        },
        timeout: 5000,
      });

      const profile = userResponse.data;

      // 3. Fetch GitHub Emails if profile email is missing/private
      let email = profile.email;
      if (!email) {
        try {
          const emailsResponse = await axios.get('https://api.github.com/user/emails', {
            headers: {
              Authorization: `token ${accessToken}`,
            },
            timeout: 5000,
          });
          const primaryEmail = emailsResponse.data.find(
            (e: any) => e.primary && e.verified
          );
          email = primaryEmail?.email ?? null;
        } catch (e) {}
      }

      // 4. Find or Create User and generate tokens
      const result = await authService.findOrCreateGithubUser({
        id: String(profile.id),
        login: profile.login,
        email: email || undefined,
        name: profile.name || profile.login,
        avatar_url: profile.avatar_url,
      });

      // 5. Rotate refresh token in cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // 6. Redirect to frontend callback route securely (client exchanges httpOnly refresh token cookie)
      res.redirect(
        `${frontendUrl}/auth/callback`
      );
    } catch (err: any) {
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }),
};
