/**
 * 验证码存储抽象接口
 * 未来可无缝扩展为 RedisVerificationCodeStore
 */
export class BaseVerificationCodeStore {
  async get(key) {
    throw new Error('Not implemented');
  }
  async set(key, value, ttlSeconds) {
    throw new Error('Not implemented');
  }
  async delete(key) {
    throw new Error('Not implemented');
  }
  async incrementAttempts(key) {
    throw new Error('Not implemented');
  }
}

/**
 * 内存验证码存储实现 (适用于单进程开发与测试)
 */
export class MemoryVerificationCodeStore extends BaseVerificationCodeStore {
  constructor() {
    super();
    this.store = new Map();
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    // 惰性过期清理
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  async set(key, value, ttlSeconds = 300) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, {
      ...value,
      expiresAt,
      attempts: value.attempts || 0,
      createdAt: Date.now(),
    });
  }

  async delete(key) {
    this.store.delete(key);
  }

  async incrementAttempts(key) {
    const entry = await this.get(key);
    if (!entry) return 0;
    entry.attempts = (entry.attempts || 0) + 1;
    this.store.set(key, entry);
    return entry.attempts;
  }

  clear() {
    this.store.clear();
  }
}
