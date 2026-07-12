import { Router } from 'express';
import * as ctrl from './auth.controller.js';
import validate from '../../middleware/validate.js';
import { sendCodeSchema, loginSchema } from './auth.validator.js';
import auth from '../../middleware/auth.js';

const router = Router();

router.post('/send-code', validate(sendCodeSchema), ctrl.sendCode);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', auth, ctrl.logout);

export default router;
