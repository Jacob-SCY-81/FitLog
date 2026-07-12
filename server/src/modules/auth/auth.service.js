import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import prisma from '../../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import config from '../../config/index.js';

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

let mailTransporter = null;

function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    throw new Error('SMTP is not fully configured in environment variables.');
  }
  mailTransporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
  return mailTransporter;
}

// --- Public ---

export async function sendVerificationCode(email, clientIp) {
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

  // SMTP Real email sending
  if (config.emailMode === 'production') {
    try {
      const transporter = getMailTransporter();
      await transporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject: '[FitLog] 您的登录验证码',
        text: `您的验证码是 ${code}。它将在 10 分钟后过期。如非本人操作，请忽略此邮件。`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #10b981;">FitLog 训练记录</h2>
            <p>您好，</p>
            <p>您的登录验证码是：</p>
            <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 10px 20px; border-radius: 8px; display: inline-block; letter-spacing: 2px; color: #047857; margin: 10px 0;">
              ${code}
            </div>
            <p>验证码在 10 分钟内有效。如果这不是您的操作，请忽略此邮件。</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #9ca3af;">本邮件为系统自动发出，请勿回复。</p>
          </div>
        `,
      });
      console.log(`[FitLog] Verification code sent to ${email} via SMTP.`);
      return { success: true, mode: 'smtp' };
    } catch (smtpErr) {
      console.error('[FitLog] SMTP send failed, falling back to console:', smtpErr.message);
    }
  }

  // Dev mode: log to console
  console.log(`\n========================================`);
  console.log(`[DEV] Verification code for ${email}: ${code}`);
  console.log(`========================================\n`);

  return { success: true, mode: 'console' };
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
      user: { id: user.id, email: user.email },
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
  const tokenPayload = { sub: user.id, email: user.email };
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
    user: { id: user.id, email: user.email },
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
  const tokenPayload = { sub: payload.sub, email: payload.email };
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
