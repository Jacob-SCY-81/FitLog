import crypto from 'crypto';

/**
 * 全局 Request ID 注入中间件
 * 支持外部网关/反向代理透传的 X-Request-Id，若缺失则自动生成安全唯一 ID。
 */
export function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = incomingId || `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

export default requestIdMiddleware;
