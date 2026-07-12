import { Router } from 'express';
import auth from '../../middleware/auth.js';
import * as ctrl from './export.controller.js';

const router = Router();

router.get('/', auth, ctrl.exportData);

export default router;
