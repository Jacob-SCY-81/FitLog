import * as authService from './auth.service.js';
import { success, error } from '../../lib/response.js';

/**
 * 统一设置 RefreshToken HttpOnly Cookie
 * 生产环境强制开启 Secure 标记，开发环境与测试环境允许使用普通 Cookie
 */
function setRefreshTokenCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/api/v1/auth',
  });
}

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

    setRefreshTokenCookie(res, result.refreshToken);

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

    // 轮转设置新 RefreshToken
    setRefreshTokenCookie(res, result.refreshToken);

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

export async function sendPhoneCode(req, res, next) {
  try {
    const { phone } = req.validatedBody;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await authService.sendPhoneVerificationCode(phone, clientIp);
    success(res, {
      message: result.message,
      cooldownSec: result.cooldownSec,
      expiresInSec: result.expiresInSec,
    });
  } catch (err) {
    next(err);
  }
}

export async function phoneLogin(req, res, next) {
  try {
    const { phone, code } = req.validatedBody;
    const result = await authService.loginWithPhone(phone, code);

    setRefreshTokenCookie(res, result.refreshToken);

    success(res, {
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  try {
    const result = await authService.registerWithPhonePassword(req.validatedBody);

    setRefreshTokenCookie(res, result.refreshToken);

    success(res, {
      user: result.user,
      accessToken: result.accessToken,
    }, 201);
  } catch (err) {
    next(err);
  }
}

export async function phonePasswordLogin(req, res, next) {
  try {
    const result = await authService.loginWithPhonePassword(req.validatedBody);

    setRefreshTokenCookie(res, result.refreshToken);

    success(res, {
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err) {
    next(err);
  }
}
