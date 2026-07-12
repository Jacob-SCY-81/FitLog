import { Router } from 'express';
import auth from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import { createTemplateSchema } from './template.validator.js';
import * as ctrl from './template.controller.js';

const router = Router();

router.get('/', auth, ctrl.listTemplates);
router.get('/:id', auth, ctrl.getTemplate);
router.post('/', auth, validate(createTemplateSchema), ctrl.createTemplate);
router.delete('/:id', auth, ctrl.deleteTemplate);
router.get('/:id/workout', auth, ctrl.loadTemplateForWorkout);

export default router;
