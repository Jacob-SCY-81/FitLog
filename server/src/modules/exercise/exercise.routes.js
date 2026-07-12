import { Router } from 'express';
import auth from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import { createExerciseSchema, listExercisesQuerySchema } from './exercise.validator.js';
import * as ctrl from './exercise.controller.js';

const router = Router();

// Query validation middleware — validates req.query instead of req.body
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const msg = firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Validation failed';
      return res.status(400).json({ code: 400, message: msg, error: 'VALIDATION_ERROR', data: null });
    }
    req.validatedQuery = result.data;
    next();
  };
}

router.get('/', auth, validateQuery(listExercisesQuerySchema), ctrl.listExercises);
router.get('/options', auth, ctrl.filterOptions);
router.get('/:id', auth, ctrl.getExercise);
router.post('/', auth, validate(createExerciseSchema), ctrl.createExercise);
router.delete('/:id', auth, ctrl.deleteExercise);

export default router;
