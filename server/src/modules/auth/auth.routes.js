import { Router } from 'express';
import * as ctrl from './auth.controller.js';
import validate from '../../middleware/validate.js';
import {
  sendCodeSchema,
  loginSchema,
  sendPhoneCodeSchema,
  phoneLoginSchema,
  registerSchema,
  phonePasswordLoginSchema,
} from './auth.validator.js';
import auth from '../../middleware/auth.js';

import { rateLimiter } from '../../lib/rate-limit/memory-rate-limiter.js';

const router = Router();

// --- FITLOG AUTH V2: 手机号 + 密码全新主认证流程 ---
router.post('/register', validate(registerSchema), ctrl.register);
router.post('/phone-password/login', validate(phonePasswordLoginSchema), ctrl.phonePasswordLogin);

// --- 既有 Email 登录路由 (次级备用兼容) ---
router.post('/send-code', validate(sendCodeSchema), ctrl.sendCode);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', auth, ctrl.logout);

// --- 兼容旧短信路由 ---
router.post('/phone/send-code', validate(sendPhoneCodeSchema), ctrl.sendPhoneCode);
router.post('/phone/login', validate(phoneLoginSchema), ctrl.phoneLogin);

// --- 自动化测试专用清理端点 (生产环境严格禁用) ---
if (process.env.NODE_ENV !== 'production') {
  router.post('/test/clear-rate-limit', (_req, res) => {
    rateLimiter.clear();
    res.json({ ok: true });
  });
}

export default router;
