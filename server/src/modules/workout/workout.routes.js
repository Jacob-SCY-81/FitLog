import { Router } from 'express';
import auth from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import idempotency from '../../middleware/idempotency.js';
import { createWorkoutSchema, listWorkoutsSchema, updateWorkoutSchema } from './workout.validator.js';
import * as ctrl from './workout.controller.js';

const router = Router();

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

router.get('/', auth, validateQuery(listWorkoutsSchema), ctrl.listWorkouts);
router.post('/', auth, idempotency, validate(createWorkoutSchema), ctrl.createWorkout);
router.get('/:id', auth, ctrl.getWorkout);
router.delete('/:id', auth, ctrl.deleteWorkout);
router.put('/:id', auth, validate(updateWorkoutSchema), ctrl.updateWorkout);

export default router;
