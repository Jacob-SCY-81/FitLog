import logger from '../logger/logger.js';

/**
 * 统一错误捕获与追踪抽象
 * 可扩展接入外部 APM (如 Sentry, Datadog 等)
 */
export function captureException(err, context = {}) {
  const errorPayload = {
    errorName: err.name || 'Error',
    errorMessage: err.message || 'Unknown error',
    errorCode: err.errorCode || err.code || null,
    statusCode: err.statusCode || 500,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    ...context,
  };

  logger.error(`[ErrorTracker] 捕获未处理或严重异常: ${err.message}`, errorPayload);

  return errorPayload;
}

export default {
  captureException,
};
