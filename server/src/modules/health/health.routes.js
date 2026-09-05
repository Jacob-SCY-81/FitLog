import { Router } from 'express';
import * as healthController from './health.controller.js';

const router = Router();

router.get('/', healthController.getHealth);
router.get('/live', healthController.getLiveness);
router.get('/ready', healthController.getReadiness);

export default router;
