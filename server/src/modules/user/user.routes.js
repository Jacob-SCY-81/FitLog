import { Router } from 'express';
import auth from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import { updateProfileSchema, bindPhoneSchema } from './user.validator.js';
import * as ctrl from './user.controller.js';

const router = Router();

router.get('/profile', auth, ctrl.getProfile);
router.put('/profile', auth, validate(updateProfileSchema), ctrl.updateProfile);
router.post('/bind-phone', auth, validate(bindPhoneSchema), ctrl.bindPhone);

export default router;
