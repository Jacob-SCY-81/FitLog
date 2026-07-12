import * as measurementService from './measurement.service.js';
import { success } from '../../lib/response.js';

export async function listMeasurements(req, res, next) {
  try {
    const result = await measurementService.listMeasurements(req.validatedQuery, req.user.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createMeasurement(req, res, next) {
  try {
    const m = await measurementService.createMeasurement(req.validatedBody, req.user.id);
    success(res, m, 201);
  } catch (err) {
    next(err);
  }
}

export async function deleteMeasurement(req, res, next) {
  try {
    await measurementService.deleteMeasurement(req.params.id, req.user.id);
    success(res, { message: 'Measurement deleted.' });
  } catch (err) {
    next(err);
  }
}

export async function getWeightTrend(req, res, next) {
  try {
    const days = [30, 90, 180, 365].includes(Number(req.query.days))
      ? Number(req.query.days) : 90;
    const trend = await measurementService.getWeightTrend(req.user.id, days);
    success(res, trend);
  } catch (err) {
    next(err);
  }
}
