import { Router } from 'express';
import auth from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import { updateProfileSchema } from './user.validator.js';
import * as ctrl from './user.controller.js';

const router = Router();

router.get('/profile', auth, ctrl.getProfile);
router.put('/profile', auth, validate(updateProfileSchema), ctrl.updateProfile);

export default router;
