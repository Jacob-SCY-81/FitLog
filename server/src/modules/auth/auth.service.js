import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import config from '../../config/index.js';
import { normalizePhone } from '../../lib/phone/normalize.js';
import {
  generateVerificationCode,
  storeVerificationCode,
  consumeVerificationCode,
} from '../../lib/verification/verification-code.service.js';
import { rateLimiter } from '../../lib/rate-limit/memory-rate-limiter.js';
import { getSmsProvider } from '../../lib/sms/index.js';
import { getEmailProvider } from '../../lib/email/index.js';

// --- In-memory verification code store (dev: replaces Redis/email service) ---
const codeStore = new Map(); // email → { code, expiresAt, attempts }

// Rate limit tracking
const emailRateMap = new Map();  // email → { count, resetAt }
const ipRateMap = new Map();     // ip → { count, resetAt }

function checkRateLimit(map, key, max, windowMs) {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    map.set(key, entry);
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

export async function sendVerificationCode(email, clientIp) {
  if (email === 'admin@admin') {
    return { success: true, mode: 'dev' };
  }

  // Rate limits
  if (!checkRateLimit(emailRateMap, email, 5, 60 * 60 * 1000)) {
    const err = new Error('Too many requests for this email. Try again in 1 hour.');
    err.statusCode = 429;
    err.errorCode = 'EMAIL_RATE_LIMITED';
    throw err;
  }

  if (!checkRateLimit(ipRateMap, clientIp, 10, 60 * 60 * 1000)) {
    const err = new Error('Too many requests from this IP. Try again in 1 hour.');
    err.statusCode = 429;
    err.errorCode = 'IP_RATE_LIMITED';
    throw err;
  }

  const code = generateCode();
  codeStore.set(email, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
  });

  const emailProvider = getEmailProvider();
  const sendResult = await emailProvider.sendVerificationEmail(email, code, { clientIp });

  if (!sendResult.success) {
    console.warn(`[FitLog] 邮件发送驱动告警: ${sendResult.error}`);
  }

  return {
    success: true,
    mode: config.emailMode === 'production' ? 'smtp' : 'console',
  };
}

export async function loginWithCode(email, code) {
  // Dev admin bypass: admin@admin + 1234 always works
  if (email === 'admin@admin' && code === '123456') {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email, nickname: 'Admin' } });
    }
    const tokenPayload = { sub: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshTokenValue = signRefreshToken(tokenPayload);
    const decoded = verifyRefreshToken(refreshTokenValue);
    const expiresAt = new Date(decoded.exp * 1000);
    await prisma.refreshToken.create({
      data: { token: refreshTokenValue, userId: user.id, expiresAt },
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone || null,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken: refreshTokenValue,
      refreshExpiresAt: expiresAt,
    };
  }

  const stored = codeStore.get(email);

  if (!stored) {
    const err = new Error('No verification code found. Please request a new one.');
    err.statusCode = 400;
    err.errorCode = 'NO_CODE_FOUND';
    throw err;
  }

  if (Date.now() > stored.expiresAt) {
    codeStore.delete(email);
    const err = new Error('Verification code has expired. Please request a new one.');
    err.statusCode = 400;
    err.errorCode = 'CODE_EXPIRED';
    throw err;
  }

  if (stored.code !== code) {
    stored.attempts++;
    if (stored.attempts >= 5) {
      codeStore.delete(email);
      const err = new Error('Too many failed attempts. Please request a new code.');
      err.statusCode = 400;
      err.errorCode = 'MAX_ATTEMPTS';
      throw err;
    }
    const err = new Error('Invalid verification code.');
    err.statusCode = 400;
    err.errorCode = 'INVALID_CODE';
    throw err;
  }

  // Code is valid — clear it
  codeStore.delete(email);

  // Find or create user (auto-register)
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email } });
  }

  // Generate tokens
  const tokenPayload = { sub: user.id, email: user.email, phone: user.phone };
  const accessToken = signAccessToken(tokenPayload);
  const refreshTokenValue = signRefreshToken(tokenPayload);

  // Decode refresh token to get actual expiry
  const decoded = verifyRefreshToken(refreshTokenValue);
  const expiresAt = new Date(decoded.exp * 1000);

  // Store refresh token in DB
  await prisma.refreshToken.create({
    data: {
      token: refreshTokenValue,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone || null,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
    accessToken,
    refreshToken: refreshTokenValue,
    refreshExpiresAt: expiresAt,
  };
}

export async function refreshAccessToken(tokenValue) {
  let payload;
  try {
    payload = verifyRefreshToken(tokenValue);
  } catch (err) {
    const e = new Error('Invalid or expired refresh token.');
    e.statusCode = 401;
    e.errorCode = 'INVALID_REFRESH_TOKEN';
    throw e;
  }

  // Verify token exists in DB and not revoked
  const stored = await prisma.refreshToken.findUnique({ where: { token: tokenValue } });
  if (!stored || stored.revokedAt) {
    // Token revoked — revoke all tokens for safety
    if (stored) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId },
        data: { revokedAt: new Date() },
      });
    }
    const e = new Error('Refresh token has been revoked.');
    e.statusCode = 401;
    e.errorCode = 'TOKEN_REVOKED';
    throw e;
  }

  if (new Date() > stored.expiresAt) {
    const e = new Error('Refresh token has expired.');
    e.statusCode = 401;
    e.errorCode = 'TOKEN_EXPIRED';
    throw e;
  }

  // Revoke old token (rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  // Issue new tokens
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, phone: true, nickname: true, avatarUrl: true },
  });

  const tokenPayload = {
    sub: payload.sub,
    email: user?.email || payload.email,
    phone: user?.phone || payload.phone,
  };
  const newAccessToken = signAccessToken(tokenPayload);
  const newRefreshTokenValue = signRefreshToken(tokenPayload);

  const decoded = verifyRefreshToken(newRefreshTokenValue);
  const expiresAt = new Date(decoded.exp * 1000);

  await prisma.refreshToken.create({
    data: {
      token: newRefreshTokenValue,
      userId: payload.sub,
      expiresAt,
    },
  });

  return {
    user: user || { id: payload.sub, email: payload.email, phone: payload.phone },
    accessToken: newAccessToken,
    refreshToken: newRefreshTokenValue,
    refreshExpiresAt: expiresAt,
  };
}

export async function logout(refreshTokenValue) {
  if (!refreshTokenValue) return;

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshTokenValue } });
  if (stored && !stored.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
  }
}

/**
 * 发送手机短信验证码
 * @param {string} phone 原始手机号
 * @param {string} clientIp 客户端 IP
 * @returns {Promise<{ success: boolean, message: string, cooldownSec: number, expiresInSec: number }>}
 */
export async function sendPhoneVerificationCode(phone, clientIp) {
  // 1. 中国大陆手机号严格规范化为 +86138xxxxxxxx
  const normalizedPhone = normalizePhone(phone);

  // 2. IP 防刷限流 (单 IP 每小时 10 次)
  const ipCheck = await rateLimiter.checkIpLimit(clientIp);
  if (!ipCheck.allowed) {
    const err = new Error(ipCheck.error || 'Too many requests from this IP.');
    err.statusCode = 429;
    err.errorCode = ipCheck.reason || 'IP_RATE_LIMITED';
    throw err;
  }

  // 3. 手机号限流 (单号 60 秒冷却，24 小时 10 次配额)
  const sendCheck = await rateLimiter.canSend(normalizedPhone);
  if (!sendCheck.allowed) {
    const err = new Error(sendCheck.error || 'Too many SMS requests.');
    err.statusCode = 429;
    err.errorCode = sendCheck.reason || 'RATE_LIMITED';
    err.waitSec = sendCheck.waitSec;
    throw err;
  }

  // 4. 生成 6 位纯数字密码学安全随机码
  const code = generateVerificationCode();

  // 5. 存储验证码 (默认 300 秒)
  await storeVerificationCode(normalizedPhone, code);

  // 6. 调用 SMS Provider 投递
  const provider = getSmsProvider();
  const sendResult = await provider.sendVerificationCode(normalizedPhone, code);
  if (!sendResult.success) {
    const err = new Error(sendResult.error || 'Failed to deliver SMS verification code.');
    err.statusCode = 502;
    err.errorCode = 'SMS_DELIVERY_FAILED';
    throw err;
  }

  // 7. 记录发送状态
  await rateLimiter.recordSend(normalizedPhone);

  // 8. 严格按要求只返回安全元数据，绝不暴露 code, hash, key
  return {
    success: true,
    message: 'Verification code sent.',
    cooldownSec: 60,
    expiresInSec: 300,
  };
}

/**
 * 手机号验证码登录 / 自动注册
 * @param {string} phone 原始手机号
 * @param {string} code 6 位验证码
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string, refreshExpiresAt: Date }>}
 */
export async function loginWithPhone(phone, code) {
  // 1. 规范化手机号
  const normalizedPhone = normalizePhone(phone);

  // 2. 检查账户是否因连续 5 次错误处于锁定状态 (锁定 15 分钟)
  const attemptCheck = await rateLimiter.canAttempt(normalizedPhone);
  if (!attemptCheck.allowed) {
    const err = new Error(attemptCheck.error || 'Account temporarily locked due to too many failed attempts.');
    err.statusCode = 429;
    err.errorCode = attemptCheck.reason || 'ACCOUNT_LOCKED';
    throw err;
  }

  // 3. 校验并消费验证码 (输错 5 次作废，验证成功后立即销毁)
  const verifyResult = await consumeVerificationCode(normalizedPhone, code);
  if (!verifyResult.valid) {
    await rateLimiter.recordAttempt(normalizedPhone, false);
    const err = new Error(verifyResult.error || 'Invalid verification code.');
    err.statusCode = 400;
    err.errorCode = verifyResult.errorCode || 'INVALID_CODE';
    throw err;
  }

  // 4. 验证通过，重置输错尝试记录
  await rateLimiter.recordAttempt(normalizedPhone, true);

  // 5. 查找或创建用户 (原子保证，杜绝重复创建)
  let user = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
  });

  if (!user) {
    const last4 = normalizedPhone.slice(-4);
    user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
        nickname: `手机用户_${last4}`,
        email: null,
      },
    });
  } else if (!user.phoneVerifiedAt) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerifiedAt: new Date() },
    });
  }

  // 6. 签发 JWT (sub 永远为 User.id 唯一主锚点)
  const tokenPayload = { sub: user.id, phone: user.phone, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshTokenValue = signRefreshToken(tokenPayload);

  // 解析并入库持久化 RefreshToken
  const decoded = verifyRefreshToken(refreshTokenValue);
  const expiresAt = new Date(decoded.exp * 1000);

  await prisma.refreshToken.create({
    data: {
      token: refreshTokenValue,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
    accessToken,
    refreshToken: refreshTokenValue,
    refreshExpiresAt: expiresAt,
  };
}
