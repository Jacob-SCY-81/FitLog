import * as authService from './auth.service.js';
import { success, error } from '../../lib/response.js';

export async function sendCode(req, res, next) {
  try {
    const { email } = req.validatedBody;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    await authService.sendVerificationCode(email, clientIp);
    success(res, { message: 'Verification code sent.' });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, code } = req.validatedBody;
    const result = await authService.loginWithCode(email, code);

    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: false, // set true in production with HTTPS
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/v1/auth',
    });

    success(res, {
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshTokenValue = req.cookies?.refreshToken;
    if (!refreshTokenValue) {
      return error(res, 401, 'No refresh token provided.', 'NO_REFRESH_TOKEN');
    }

    const result = await authService.refreshAccessToken(refreshTokenValue);

    // Set new refresh token cookie (rotation)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    success(res, {
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const refreshTokenValue = req.cookies?.refreshToken;
    await authService.logout(refreshTokenValue);

    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    success(res, { message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}
