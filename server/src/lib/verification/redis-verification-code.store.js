import crypto from 'crypto';
import { BaseVerificationCodeStore } from './verification-code.store.js';

// Lua 脚本：原子消费验证码并校验 (支持输错计数与达到上限自动销毁)
const CONSUME_CODE_LUA = `
local exists = redis.call('EXISTS', KEYS[1])
if exists == 0 then
    return { 0, 'CODE_NOT_FOUND' }
end

local storedHash = redis.call('HGET', KEYS[1], 'hash')
local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
local maxAttempts = tonumber(ARGV[2])

if attempts >= maxAttempts then
    redis.call('DEL', KEYS[1])
    return { 0, 'MAX_ATTEMPTS_EXCEEDED' }
end

if storedHash == ARGV[1] then
    -- 验证成功：立即原子删除，杜绝任何并发请求重放消费
    redis.call('DEL', KEYS[1])
    return { 1, 'SUCCESS' }
else
    local cur = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
    if cur >= maxAttempts then
        redis.call('DEL', KEYS[1])
        return { 0, 'MAX_ATTEMPTS_EXCEEDED' }
    end
    return { 0, 'INVALID_CODE', cur }
end
`;

/**
 * 生产级 Redis 验证码存储驱动 (基于 Hash 与 Lua 原子脚本)
 */
export class RedisVerificationCodeStore extends BaseVerificationCodeStore {
  /**
   * @param {import('ioredis').Redis} redisClient 
   * @param {object} [options] 
   */
  constructor(redisClient, options = {}) {
    super();
    if (!redisClient) {
      throw new Error('RedisVerificationCodeStore requires a valid Redis client.');
    }
    this.redis = redisClient;
    this.keyPrefix = options.keyPrefix || 'sms:code';
    this.salt = options.salt || process.env.APP_SECRET || 'fitlog_sms_salt';
  }

  /**
   * 对手机号进行加盐哈希，生成安全无明文泄露的 Redis Key
   * @param {string} phone 
   * @returns {string}
   */
  getStoreKey(phone) {
    const hash = crypto
      .createHash('sha256')
      .update(`${phone}:${this.salt}`)
      .digest('hex')
      .slice(0, 16);
    return `${this.keyPrefix}:${hash}`;
  }

  /**
   * 计算验证码的安全比对摘要
   * @param {string} code 
   * @returns {string}
   */
  hashCode(code) {
    return crypto
      .createHash('sha256')
      .update(`${code}:${this.salt}`)
      .digest('hex');
  }

  /**
   * 读取验证码元数据
   * @param {string} phone 
   * @returns {Promise<{ attempts: number, createdAt: number, hash: string } | null>}
   */
  async get(phone) {
    const key = this.getStoreKey(phone);
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return {
      hash: data.hash,
      attempts: parseInt(data.attempts || '0', 10),
      createdAt: parseInt(data.createdAt || '0', 10),
    };
  }

  /**
   * 写入验证码（默认 300 秒硬超时）
   * @param {string} phone 
   * @param {{ code: string, attempts?: number }} value 
   * @param {number} [ttlSeconds=300] 
   */
  async set(phone, value, ttlSeconds = 300) {
    const key = this.getStoreKey(phone);
    const codeHash = this.hashCode(value.code);
    const now = Date.now();

    // 采用 Redis Pipeline 保证写入与过期时间原子设定
    const pipeline = this.redis.pipeline();
    pipeline.hset(key, {
      hash: codeHash,
      attempts: value.attempts || 0,
      createdAt: now,
    });
    pipeline.expire(key, ttlSeconds);
    await pipeline.exec();
  }

  /**
   * 删除验证码
   * @param {string} phone 
   */
  async delete(phone) {
    const key = this.getStoreKey(phone);
    await this.redis.del(key);
  }

  /**
   * 累加输错尝试次数
   * @param {string} phone 
   * @returns {Promise<number>}
   */
  async incrementAttempts(phone) {
    const key = this.getStoreKey(phone);
    return await this.redis.hincrby(key, 'attempts', 1);
  }

  /**
   * 执行 Lua 脚本单步原子消费校验
   * @param {string} phone 
   * @param {string} inputCode 
   * @param {number} [maxAttempts=5] 
   * @returns {Promise<{ valid: boolean, error?: string, errorCode?: string, remainingAttempts?: number }>}
   */
  async consumeAtomic(phone, inputCode, maxAttempts = 5) {
    const key = this.getStoreKey(phone);
    const inputHash = this.hashCode(inputCode);

    try {
      // 执行 EVAL 脚本
      const result = await this.redis.eval(
        CONSUME_CODE_LUA,
        1,
        key,
        inputHash,
        maxAttempts
      );

      const status = result[0];
      const code = result[1];
      const attemptsOrRemaining = result[2];

      if (status === 1) {
        return { valid: true };
      }

      switch (code) {
        case 'CODE_NOT_FOUND':
          return {
            valid: false,
            error: '验证码不存在或已过期，请重新获取',
            errorCode: 'CODE_NOT_FOUND',
          };
        case 'MAX_ATTEMPTS_EXCEEDED':
          return {
            valid: false,
            error: '输错次数过多，验证码已失效，请重新获取',
            errorCode: 'MAX_ATTEMPTS_EXCEEDED',
          };
        case 'INVALID_CODE':
          const currentAttempts = attemptsOrRemaining || 1;
          const remaining = Math.max(0, maxAttempts - currentAttempts);
          return {
            valid: false,
            error: `验证码错误，还可尝试 ${remaining} 次`,
            errorCode: 'INVALID_CODE',
            remainingAttempts: remaining,
          };
        default:
          return {
            valid: false,
            error: '验证码校验失败',
            errorCode: 'VALIDATION_FAILED',
          };
      }
    } catch (err) {
      console.error('[REDIS_STORE] Lua 执行失败:', err.message);
      throw new Error('安全验证存储异常，请稍后重试');
    }
  }
}
