import crypto from 'crypto';
import { BaseRateLimiter } from './rate-limiter.interface.js';

// Lua 脚本：原子自增并在初次自增时附加过期时间 (针对日配额与 IP 配额)
const INCR_WITH_EXPIRE_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return current
`;

// Lua 脚本：原子记录登录失败并在达到上限时执行锁定
const RECORD_FAIL_ATTEMPT_LUA = `
local failKey = KEYS[1]
local lockKey = KEYS[2]
local maxFails = tonumber(ARGV[1])
local lockTtl = tonumber(ARGV[2])

local curFails = redis.call('INCR', failKey)
if curFails == 1 then
    redis.call('EXPIRE', failKey, 600) -- 失败计数维持 10 分钟窗口
end

if curFails >= maxFails then
    redis.call('SET', lockKey, '1', 'EX', lockTtl) -- 触发锁定 15 分钟
    redis.call('DEL', failKey)
    return 1 -- 已锁定
end

return 0 -- 未锁定
`;

/**
 * 生产级 Redis 分布式限流器 (支持多实例集群强一致状态与 Fail-Closed 安全拦截)
 */
export class RedisRateLimiter extends BaseRateLimiter {
  /**
   * @param {import('ioredis').Redis} redisClient 
   * @param {object} [options]
   */
  constructor(redisClient, options = {}) {
    super();
    if (!redisClient) {
      throw new Error('RedisRateLimiter requires a valid Redis client.');
    }
    this.redis = redisClient;
    this.salt = options.salt || process.env.APP_SECRET || 'fitlog_rate_salt';
    this.cooldownSec = options.cooldownSec || 60;
    this.dailyLimit = options.dailyLimit || 10;
    this.hourlyIpLimit = options.hourlyIpLimit || 10;
    this.maxFailAttempts = options.maxFailAttempts || 5;
    this.lockoutSec = options.lockoutSec || 900; // 15 分钟
  }

  /**
   * 对手机号进行脱敏哈希处理
   * @param {string} phone 
   * @returns {string}
   */
  getPhoneHash(phone) {
    return crypto
      .createHash('sha256')
      .update(`${phone}:${this.salt}`)
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * 格式化当日日期字符串 (YYYYMMDD)
   * @returns {string}
   */
  getDateKey() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  /**
   * 格式化当前小时字符串 (YYYYMMDDHH)
   * @returns {string}
   */
  getHourKey() {
    const d = new Date();
    const dateStr = this.getDateKey();
    const hh = String(d.getHours()).padStart(2, '0');
    return `${dateStr}${hh}`;
  }

  /**
   * 检查是否允许向指定手机号发送短信
   * @param {string} phone 
   * @returns {Promise<{ allowed: boolean, reason?: string, waitSec?: number, error?: string }>}
   */
  async canSend(phone) {
    const phoneHash = this.getPhoneHash(phone);
    const cooldownKey = `sms:cooldown:${phoneHash}`;
    const dateStr = this.getDateKey();
    const dailyQuotaKey = `sms:quota:phone:${phoneHash}:${dateStr}`;

    try {
      // 1. 检查 60 秒冷却
      const cooldownTtl = await this.redis.ttl(cooldownKey);
      if (cooldownTtl > 0) {
        return {
          allowed: false,
          reason: 'COOLDOWN',
          waitSec: cooldownTtl,
          error: `请求过于频繁，请等待 ${cooldownTtl} 秒后再试`,
        };
      }

      // 2. 检查单日配额
      const dailyCount = parseInt((await this.redis.get(dailyQuotaKey)) || '0', 10);
      if (dailyCount >= this.dailyLimit) {
        return {
          allowed: false,
          reason: 'DAILY_QUOTA_EXCEEDED',
          error: '该手机号今日短信发送次数已达上限，请明日再试',
        };
      }

      return { allowed: true };
    } catch (err) {
      // 严格 Fail-Closed：Redis 异常绝不放行短信，防黑产刷量
      console.error('[REDIS_RATE_LIMITER] canSend 异常，执行 Fail-Closed 拦截:', err.message);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_ERROR',
        error: '安全验证服务繁忙，请稍后重试',
      };
    }
  }

  /**
   * 记录短信发送成功（更新 60s 冷却与每日发送计数）
   * @param {string} phone 
   */
  async recordSend(phone) {
    const phoneHash = this.getPhoneHash(phone);
    const cooldownKey = `sms:cooldown:${phoneHash}`;
    const dateStr = this.getDateKey();
    const dailyQuotaKey = `sms:quota:phone:${phoneHash}:${dateStr}`;

    try {
      const pipeline = this.redis.pipeline();
      // 写入 60 秒冷却
      pipeline.set(cooldownKey, '1', 'EX', this.cooldownSec);
      // 原子累加每日发送次数 (TTL 86400 秒)
      pipeline.eval(INCR_WITH_EXPIRE_LUA, 1, dailyQuotaKey, 86400);
      await pipeline.exec();
    } catch (err) {
      console.error('[REDIS_RATE_LIMITER] recordSend 异常:', err.message);
    }
  }

  /**
   * 检查 IP 防刷额度 (单 IP 1 小时最多 10 次)
   * @param {string} ip 
   * @returns {Promise<{ allowed: boolean, reason?: string, error?: string }>}
   */
  async checkIpLimit(ip) {
    if (!ip || ip === 'unknown') return { allowed: true };

    const cleanIp = ip.replace(/[^a-zA-Z0-9]/g, '_');
    const hourStr = this.getHourKey();
    const ipKey = `sms:quota:ip:${cleanIp}:${hourStr}`;

    try {
      // 执行原子自增
      const curCount = await this.redis.eval(INCR_WITH_EXPIRE_LUA, 1, ipKey, 3600);
      if (curCount > this.hourlyIpLimit) {
        return {
          allowed: false,
          reason: 'IP_RATE_LIMITED',
          error: '当前网络环境请求过于频繁，请稍后再试',
        };
      }
      return { allowed: true };
    } catch (err) {
      // Fail-Closed
      console.error('[REDIS_RATE_LIMITER] checkIpLimit 异常，Fail-Closed:', err.message);
      return {
        allowed: false,
        reason: 'IP_RATE_LIMITED',
        error: '当前网络环境请求过于频繁，请稍后再试',
      };
    }
  }

  /**
   * 检查账号是否因多次输错被临时锁定
   * @param {string} phone 
   * @returns {Promise<{ allowed: boolean, reason?: string, waitMinutes?: number, error?: string }>}
   */
  async canAttempt(phone) {
    const phoneHash = this.getPhoneHash(phone);
    const lockKey = `sms:lock:phone:${phoneHash}`;

    try {
      const ttl = await this.redis.ttl(lockKey);
      if (ttl > 0) {
        const waitMinutes = Math.ceil(ttl / 60);
        return {
          allowed: false,
          reason: 'ACCOUNT_LOCKED',
          waitMinutes,
          error: `登录尝试失败次数过多，账号已临时锁定，请 ${waitMinutes} 分钟后再试`,
        };
      }
      return { allowed: true };
    } catch (err) {
      console.error('[REDIS_RATE_LIMITER] canAttempt 异常:', err.message);
      return { allowed: true };
    }
  }

  /**
   * 记录登录尝试结果（成功则清除锁定与失败计数；失败累加并在第 5 次触发锁定 15 分钟）
   * @param {string} phone 
   * @param {boolean} success 
   */
  async recordAttempt(phone, success) {
    const phoneHash = this.getPhoneHash(phone);
    const failKey = `sms:failcount:phone:${phoneHash}`;
    const lockKey = `sms:lock:phone:${phoneHash}`;

    try {
      if (success) {
        await this.redis.del(failKey, lockKey);
        return;
      }

      await this.redis.eval(
        RECORD_FAIL_ATTEMPT_LUA,
        2,
        failKey,
        lockKey,
        this.maxFailAttempts,
        this.lockoutSec
      );
    } catch (err) {
      console.error('[REDIS_RATE_LIMITER] recordAttempt 异常:', err.message);
    }
  }

  /**
   * 清理当前测试相关的键（供单元测试）
   */
  async clear() {
    // 单元测试清理
    try {
      const keys = await this.redis.keys('sms:*');
      if (keys && keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // ignore
    }
  }
}
