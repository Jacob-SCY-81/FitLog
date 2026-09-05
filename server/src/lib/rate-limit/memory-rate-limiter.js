import { BaseRateLimiter } from './rate-limiter.interface.js';

/**
 * 内存限流器实现
 * 
 * 规则：
 * 1. 单手机号 60 秒发送冷却时间 (Cooldown)
 * 2. 单手机号 24 小时内最多发送 10 次短信 (Daily Quota)
 * 3. 单 IP 1 小时内最多发送 10 次短信 (Hourly IP Quota)
 * 4. 连续登录尝试失败锁定：10 分钟内连续失败 5 次，锁定 15 分钟
 */
export class MemoryRateLimiter extends BaseRateLimiter {
  constructor() {
    super();
    this.sendHistory = new Map();     // phone -> { lastSendAt, dailyCount, dailyResetAt }
    this.ipHistory = new Map();       // ip -> { count, resetAt }
    this.attemptHistory = new Map();  // phone -> { failedAttempts, lockedUntil }
  }

  async canSend(phone) {
    const now = Date.now();
    const entry = this.sendHistory.get(phone);

    if (!entry) {
      return { allowed: true };
    }

    // 1. 检查 60 秒冷却
    if (now - entry.lastSendAt < 60 * 1000) {
      const waitSec = Math.ceil((60 * 1000 - (now - entry.lastSendAt)) / 1000);
      return {
        allowed: false,
        reason: 'COOLDOWN',
        waitSec,
        error: `请求过于频繁，请等待 ${waitSec} 秒后再试`,
      };
    }

    // 2. 检查单日配额 (24小时)
    if (now > entry.dailyResetAt) {
      entry.dailyCount = 0;
      entry.dailyResetAt = now + 24 * 60 * 60 * 1000;
    }

    if (entry.dailyCount >= 10) {
      return {
        allowed: false,
        reason: 'DAILY_QUOTA_EXCEEDED',
        error: '该手机号今日短信发送次数已达上限，请明日再试',
      };
    }

    return { allowed: true };
  }

  async recordSend(phone) {
    const now = Date.now();
    let entry = this.sendHistory.get(phone);

    if (!entry) {
      entry = {
        lastSendAt: now,
        dailyCount: 1,
        dailyResetAt: now + 24 * 60 * 60 * 1000,
      };
    } else {
      if (now > entry.dailyResetAt) {
        entry.dailyCount = 1;
        entry.dailyResetAt = now + 24 * 60 * 60 * 1000;
      } else {
        entry.dailyCount += 1;
      }
      entry.lastSendAt = now;
    }

    this.sendHistory.set(phone, entry);
  }

  async checkIpLimit(ip) {
    if (!ip || ip === 'unknown') return { allowed: true };

    const now = Date.now();
    let entry = this.ipHistory.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + 60 * 60 * 1000 };
      this.ipHistory.set(ip, entry);
      return { allowed: true };
    }

    if (entry.count >= 10) {
      return {
        allowed: false,
        reason: 'IP_RATE_LIMITED',
        error: '当前网络环境请求过于频繁，请稍后再试',
      };
    }

    entry.count += 1;
    this.ipHistory.set(ip, entry);
    return { allowed: true };
  }

  async canAttempt(phone) {
    const now = Date.now();
    const entry = this.attemptHistory.get(phone);

    if (entry && entry.lockedUntil && now < entry.lockedUntil) {
      const waitMinutes = Math.ceil((entry.lockedUntil - now) / (60 * 1000));
      return {
        allowed: false,
        reason: 'ACCOUNT_LOCKED',
        waitMinutes,
        error: `登录尝试失败次数过多，账号已临时锁定，请 ${waitMinutes} 分钟后再试`,
      };
    }

    return { allowed: true };
  }

  async recordAttempt(phone, success) {
    const now = Date.now();
    let entry = this.attemptHistory.get(phone);

    if (success) {
      this.attemptHistory.delete(phone);
      return;
    }

    if (!entry) {
      entry = { failedAttempts: 1, lockedUntil: null };
    } else {
      entry.failedAttempts += 1;
      if (entry.failedAttempts >= 5) {
        entry.lockedUntil = now + 15 * 60 * 1000; // 锁定 15 分钟
        entry.failedAttempts = 0; // 重置计数
      }
    }

    this.attemptHistory.set(phone, entry);
  }

  clear() {
    this.sendHistory.clear();
    this.ipHistory.clear();
    this.attemptHistory.clear();
  }
}

export const rateLimiter = new MemoryRateLimiter();
