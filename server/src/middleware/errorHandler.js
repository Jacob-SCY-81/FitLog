import config from '../config/index.js';

export default function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${err.message}`);
  if (config.nodeEnv === 'development') {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    code: statusCode,
    message,
    error: err.errorCode || 'INTERNAL_ERROR',
    data: null,
  });
}
