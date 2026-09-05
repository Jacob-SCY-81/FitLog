import prisma from '../../lib/prisma.js';
import { isRedisHealthy, getRedisClient } from '../../lib/redis/redis.client.js';

/**
 * 综合系统基础健康检查
 */
export async function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
}

/**
 * Kubernetes / Docker Liveness 探针（进程存活性）
 */
export async function getLiveness(_req, res) {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Kubernetes / Docker Readiness 探针（基础设施与依赖深度就绪）
 */
export async function getReadiness(_req, res) {
  const startTime = Date.now();
  const checks = {
    database: { status: 'unknown', latencyMs: 0 },
    redis: { status: 'disabled', latencyMs: 0 },
  };

  let isReady = true;

  // 1. 探测数据库健康度
  try {
    const dbStart = Date.now();
    await Promise.race([
      prisma.$queryRaw`SELECT 1 as ping`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 2000)),
    ]);
    checks.database.status = 'healthy';
    checks.database.latencyMs = Date.now() - dbStart;
  } catch (err) {
    checks.database.status = 'unhealthy';
    checks.database.error = err.message;
    isReady = false;
  }

  // 2. 探测 Redis 健康度
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const redisStart = Date.now();
      const healthy = await isRedisHealthy();
      checks.redis.status = healthy ? 'healthy' : 'unhealthy';
      checks.redis.latencyMs = Date.now() - redisStart;
      if (!healthy) {
        // Redis 降级处理：若业务具备内存降级，不完全阻塞 readiness，但标明 degraded
        checks.redis.degraded = true;
      }
    } catch (err) {
      checks.redis.status = 'unhealthy';
      checks.redis.error = err.message;
      checks.redis.degraded = true;
    }
  } else {
    checks.redis.status = 'disabled';
    checks.redis.note = 'Running in fallback in-memory mode';
  }

  const overallDuration = Date.now() - startTime;

  const payload = {
    status: isReady ? 'ready' : 'unhealthy',
    timestamp: new Date().toISOString(),
    totalLatencyMs: overallDuration,
    checks,
  };

  res.status(isReady ? 200 : 503).json(payload);
}
