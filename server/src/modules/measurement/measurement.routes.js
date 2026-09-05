import { Router } from 'express';
import auth from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import { createMeasurementSchema, listMeasurementsSchema, updateMeasurementSchema } from './measurement.validator.js';
import * as ctrl from './measurement.controller.js';

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

router.get('/', auth, validateQuery(listMeasurementsSchema), ctrl.listMeasurements);
router.get('/latest', auth, ctrl.getLatestMeasurement);
router.post('/', auth, validate(createMeasurementSchema), ctrl.createMeasurement);
router.put('/:id', auth, validate(updateMeasurementSchema), ctrl.updateMeasurement);
router.delete('/:id', auth, ctrl.deleteMeasurement);
router.get('/trend', auth, ctrl.getMeasurementTrend);

export default router;
