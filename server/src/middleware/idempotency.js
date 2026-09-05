/**
 * In-memory idempotency store with TTL support.
 * For production, this can also hook into Redis seamlessly.
 */
class IdempotencyStore {
  constructor() {
    this.cache = new Map();
    // Periodically clean up expired keys every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return item;
  }

  set(key, status, response = null, ttlSeconds = 300) {
    this.cache.set(key, {
      status,
      response,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

export const idempotencyStore = new IdempotencyStore();

/**
 * Idempotency middleware.
 * Inspects `Idempotency-Key` header.
 */
export default function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) {
    return next();
  }

  const userId = req.user?.id || 'anonymous';
  const cacheKey = `idempotency:${userId}:${key}`;

  const cached = idempotencyStore.get(cacheKey);

  if (cached) {
    if (cached.status === 'PROCESSING') {
      return res.status(409).json({
        code: 409,
        message: 'Request with this Idempotency-Key is currently being processed.',
        error: 'CONCURRENT_REQUEST',
        data: null,
      });
    }

    if (cached.status === 'COMPLETED' && cached.response) {
      res.set('X-Cache-Lookup', 'HIT-IDEMPOTENT');
      return res.status(cached.response.statusCode).json(cached.response.body);
    }
  }

  // Mark as PROCESSING with a 30-second TTL
  idempotencyStore.set(cacheKey, 'PROCESSING', null, 30);

  // Hook into response.json to capture response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const statusCode = res.statusCode || 200;

    // Only cache successful or non-server-error responses (2xx, 4xx)
    if (statusCode < 500) {
      idempotencyStore.set(
        cacheKey,
        'COMPLETED',
        { statusCode, body },
        300 // 5 minutes TTL
      );
    } else {
      // Clear on 5xx to allow client retries
      idempotencyStore.delete(cacheKey);
    }

    return originalJson(body);
  };

  // If response emits an error or connection closes prematurely
  res.on('close', () => {
    if (!res.writableEnded) {
      idempotencyStore.delete(cacheKey);
    }
  });

  next();
}
