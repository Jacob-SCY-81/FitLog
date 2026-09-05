import { Router } from 'express';
import * as ctrl from './auth.controller.js';
import validate from '../../middleware/validate.js';
import { sendCodeSchema, loginSchema, sendPhoneCodeSchema, phoneLoginSchema } from './auth.validator.js';
import auth from '../../middleware/auth.js';

const router = Router();

// --- 既有 Email 登录路由 (保持 100% 不变) ---
router.post('/send-code', validate(sendCodeSchema), ctrl.sendCode);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', auth, ctrl.logout);

// --- Phase 2.2 手机号认证路由 ---
router.post('/phone/send-code', validate(sendPhoneCodeSchema), ctrl.sendPhoneCode);
router.post('/phone/login', validate(phoneLoginSchema), ctrl.phoneLogin);

export default router;
