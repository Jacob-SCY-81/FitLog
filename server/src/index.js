import app from './app.js';
import config from './config/index.js';
import { getRedisClient } from './lib/redis/redis.client.js';
import { setVerificationCodeStore } from './lib/verification/verification-code.service.js';
import { RedisVerificationCodeStore } from './lib/verification/redis-verification-code.store.js';
import { setRateLimiter } from './lib/rate-limit/memory-rate-limiter.js';
import { RedisRateLimiter } from './lib/rate-limit/redis-rate-limiter.js';

// 若配置了 REDIS_URL 且声明开启，则动态装配 Redis 存储与分布式限流器
if (process.env.REDIS_URL) {
  const redis = getRedisClient();
  if (redis) {
    if (process.env.VERIFICATION_STORE === 'redis') {
      setVerificationCodeStore(new RedisVerificationCodeStore(redis));
      console.log('[FitLog] 验证码存储驱动已切换为: RedisVerificationCodeStore');
    }
    if (process.env.RATE_LIMITER === 'redis') {
      setRateLimiter(new RedisRateLimiter(redis));
      console.log('[FitLog] 短信与鉴权限流器已切换为: RedisRateLimiter');
    }
  }
}

app.listen(config.port, () => {
  console.log(`[FitLog] Server running on http://localhost:${config.port}`);
  console.log(`[FitLog] Email mode: ${config.emailMode}`);
});
