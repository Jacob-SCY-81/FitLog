import crypto from 'crypto';
import { MemoryVerificationCodeStore } from './verification-code.store.js';

let _activeStore = new MemoryVerificationCodeStore();

export function setVerificationCodeStore(store) {
  _activeStore = store;
}

export function getVerificationCodeStore() {
  return _activeStore;
}

const DEFAULT_TTL_SECONDS = 300; // 5 分钟
const MAX_ALLOWED_ATTEMPTS = 5;  // 最多允许输错 5 次

/**
 * 生成 6 位纯数字密码学安全随机验证码
 * @returns {string} 6位数字验证码
 */
export function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * 存储手机号对应的验证码
 * @param {string} normalizedPhone 
 * @param {string} code 
 * @param {number} [ttlSeconds] 
 */
export async function storeVerificationCode(normalizedPhone, code, ttlSeconds = DEFAULT_TTL_SECONDS) {
  await _activeStore.set(normalizedPhone, { code, attempts: 0 }, ttlSeconds);
}

/**
 * 校验验证码（若校验通过则立即销毁，若失败累加输错计数；达到5次彻底销毁）
 * @param {string} normalizedPhone 
 * @param {string} inputCode 
 * @returns {Promise<{ valid: boolean, error?: string, errorCode?: string }>}
 */
export async function consumeVerificationCode(normalizedPhone, inputCode) {
  // 若底层存储驱动支持单步原子消费 (如 RedisVerificationCodeStore)，优先委托给原子消费防范并发争抢
  if (typeof _activeStore.consumeAtomic === 'function') {
    return await _activeStore.consumeAtomic(normalizedPhone, inputCode, MAX_ALLOWED_ATTEMPTS);
  }

  const entry = await _activeStore.get(normalizedPhone);

  if (!entry) {
    return {
      valid: false,
      error: '验证码不存在或已过期，请重新获取',
      errorCode: 'CODE_NOT_FOUND',
    };
  }

  // 检查是否达到最大尝试次数限制
  if (entry.attempts >= MAX_ALLOWED_ATTEMPTS) {
    await _activeStore.delete(normalizedPhone);
    return {
      valid: false,
      error: '输错次数过多，验证码已失效，请重新获取',
      errorCode: 'MAX_ATTEMPTS_EXCEEDED',
    };
  }

  // 严格比对
  if (entry.code !== inputCode) {
    const newAttempts = await _activeStore.incrementAttempts(normalizedPhone);
    if (newAttempts >= MAX_ALLOWED_ATTEMPTS) {
      await _activeStore.delete(normalizedPhone);
      return {
        valid: false,
        error: '输错次数过多，验证码已失效，请重新获取',
        errorCode: 'MAX_ATTEMPTS_EXCEEDED',
      };
    }
    return {
      valid: false,
      error: `验证码错误，还可尝试 ${MAX_ALLOWED_ATTEMPTS - newAttempts} 次`,
      errorCode: 'INVALID_CODE',
    };
  }

  // 校验通过：一次性使用原则，立即销毁
  await _activeStore.delete(normalizedPhone);
  return { valid: true };
}
