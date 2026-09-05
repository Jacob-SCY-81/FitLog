/**
 * 手机号与登录限流接口抽象
 * 未来可扩展为 RedisRateLimiter
 */
export class BaseRateLimiter {
  async canSend(phone) {
    throw new Error('Not implemented');
  }
  async recordSend(phone) {
    throw new Error('Not implemented');
  }
  async canAttempt(phone) {
    throw new Error('Not implemented');
  }
  async recordAttempt(phone, success) {
    throw new Error('Not implemented');
  }
  async checkIpLimit(ip) {
    throw new Error('Not implemented');
  }
}
