import { Router } from 'express';
import auth from '../../middleware/auth.js';
import * as ctrl from './stats.controller.js';

const router = Router();

router.get('/exercises-used', auth, ctrl.exercisesUsed);
router.get('/exercise/:id', auth, ctrl.exerciseStats);

export default router;
