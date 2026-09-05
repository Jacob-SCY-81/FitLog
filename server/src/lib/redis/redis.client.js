import Redis from 'ioredis';

let _redisInstance = null;
let _isHealthy = false;

/**
 * 格式化并脱敏 Redis 连接 URL
 * @param {string} url 
 * @returns {string} 脱敏后的 URL
 */
export function maskRedisUrl(url) {
  if (!url) return 'none';
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '******';
    }
    return parsed.toString();
  } catch {
    return 'invalid-url';
  }
}

/**
 * 获取或初始化全局 Redis 客户端实例
 * @param {object} [options] 自定义配置
 * @returns {import('ioredis').Redis | null}
 */
export function getRedisClient(options = {}) {
  if (_redisInstance) {
    return _redisInstance;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  const client = new Redis(redisUrl, {
    connectTimeout: 3000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 5) {
        console.error('[REDIS] 重连达到最大重试次数 (5次)，停止重试');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    ...options,
  });

  client.on('connect', () => {
    console.log(`[REDIS] 连接建立: ${maskRedisUrl(redisUrl)}`);
  });

  client.on('ready', () => {
    _isHealthy = true;
    console.log('[REDIS] 服务端已就绪 (READY)');
  });

  client.on('error', (err) => {
    _isHealthy = false;
    console.error(`[REDIS] 错误: ${err.message}`);
  });

  client.on('close', () => {
    _isHealthy = false;
    console.warn('[REDIS] 连接已关闭');
  });

  _redisInstance = client;
  return _redisInstance;
}

/**
 * 注入自定义 Redis 客户端（专供单元测试/Mock）
 * @param {any} client 
 */
export function setRedisClient(client) {
  _redisInstance = client;
  _isHealthy = !!client;
}

/**
 * 检查当前 Redis 连通健康状态
 * @returns {Promise<boolean>}
 */
export async function isRedisHealthy() {
  if (!_redisInstance) return false;
  try {
    const res = await _redisInstance.ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}

/**
 * 安全关闭并断开 Redis 连接
 */
export async function closeRedisClient() {
  if (_redisInstance) {
    try {
      if (typeof _redisInstance.disconnect === 'function') {
        _redisInstance.disconnect();
      } else if (typeof _redisInstance.quit === 'function') {
        await _redisInstance.quit();
      }
    } catch {
      // ignore
    } finally {
      _redisInstance = null;
      _isHealthy = false;
    }
  }
}
