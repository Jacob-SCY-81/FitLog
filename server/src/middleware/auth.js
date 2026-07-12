import { verifyAccessToken } from '../lib/jwt.js';
import { error } from '../lib/response.js';

export default function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 401, 'Authentication required', 'UNAUTHORIZED');
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 401, 'Access token expired', 'TOKEN_EXPIRED');
    }
    return error(res, 401, 'Invalid access token', 'INVALID_TOKEN');
  }
}
