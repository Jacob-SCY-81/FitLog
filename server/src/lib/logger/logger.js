/**
 * 敏感字段与正则表达式匹配规则
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'verificationcode',
  'code',
  'secret',
  'authorization',
  'cookie',
  'credentials',
]);

/**
 * 手机号脱敏（11位中国大陆手机号保留前3后4）
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (typeof phone !== 'string') return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}****${cleaned.slice(7)}`;
  }
  if (cleaned.length > 7) {
    return `${cleaned.slice(0, 3)}****${cleaned.slice(-2)}`;
  }
  return '****';
}

/**
 * 邮箱脱敏（保留首字母与域名）
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `*@${domain}`;
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * 递归脱敏深层对象
 * @param {any} data
 * @param {number} [depth=0]
 * @returns {any}
 */
export function maskSensitiveData(data, depth = 0) {
  if (depth > 6 || data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, depth + 1));
  }

  const masked = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.has(lowerKey)) {
      masked[key] = '[REDACTED]';
    } else if (lowerKey === 'phone' && typeof value === 'string') {
      masked[key] = maskPhone(value);
    } else if (lowerKey === 'email' && typeof value === 'string') {
      masked[key] = maskEmail(value);
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, depth + 1);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * 生产级结构化日志器
 */
class Logger {
  format(level, message, meta = {}) {
    const safeMeta = maskSensitiveData(meta);
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      environment: process.env.NODE_ENV || 'development',
      ...safeMeta,
    };
  }

  info(message, meta = {}) {
    const payload = this.format('info', message, meta);
    console.log(JSON.stringify(payload));
    return payload;
  }

  warn(message, meta = {}) {
    const payload = this.format('warn', message, meta);
    console.warn(JSON.stringify(payload));
    return payload;
  }

  error(message, meta = {}) {
    const payload = this.format('error', message, meta);
    console.error(JSON.stringify(payload));
    return payload;
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.DEBUG) {
      return null;
    }
    const payload = this.format('debug', message, meta);
    console.debug(JSON.stringify(payload));
    return payload;
  }
}

export const logger = new Logger();
export default logger;
