import rateLimit from 'express-rate-limit';

export function createRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        code: 429,
        message: message || 'Too many requests, please try again later.',
        error: 'RATE_LIMIT_EXCEEDED',
        data: null,
      });
    },
  });
}
