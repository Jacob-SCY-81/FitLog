import config from '../config/index.js';
import { captureException } from '../lib/observability/error-tracker.js';

export default function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let message = err.message;

  // Handle Prisma specific known errors
  if (err.name === 'PrismaClientKnownRequestError' || err.code?.startsWith?.('P')) {
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        errorCode = 'UNIQUE_CONSTRAINT_VIOLATION';
        message = '数据记录冲突，请勿重复提交';
        break;
      case 'P2025':
        statusCode = 404;
        errorCode = 'NOT_FOUND';
        message = '请求的数据记录不存在或已被移除';
        break;
      case 'P2003':
        statusCode = 400;
        errorCode = 'FOREIGN_KEY_VIOLATION';
        message = '关联数据引用不合法';
        break;
      default:
        statusCode = 500;
        errorCode = 'DATABASE_ERROR';
        message = '数据库操作失败';
        break;
    }
  } else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    errorCode = 'MALFORMED_JSON';
    message = '请求报文格式错误 (Malformed JSON)';
  }

  // 捕获严重服务异常
  if (statusCode >= 500) {
    captureException(err, {
      requestId: req?.id,
      method: req?.method,
      path: req?.originalUrl || req?.url,
    });
  }

  // Sanitize 500 in non-development environments
  if (statusCode === 500 && config.nodeEnv === 'production') {
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    code: statusCode,
    message,
    error: errorCode,
    data: null,
    ...(req?.id ? { requestId: req.id } : {}),
  });
}
