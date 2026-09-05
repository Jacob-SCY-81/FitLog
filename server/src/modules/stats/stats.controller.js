import * as statsService from './stats.service.js';
import { success } from '../../lib/response.js';

export async function exercisesUsed(req, res, next) {
  try {
    const exercises = await statsService.getExercisesUsed(req.user.id);
    success(res, exercises);
  } catch (err) {
    next(err);
  }
}

export async function exerciseStats(req, res, next) {
  try {
    const ALLOWED_DAYS = [30, 90, 180, 365];
    const rawDays = parseInt(req.query.days) || 90;
    const days = ALLOWED_DAYS.includes(rawDays) ? rawDays : 90;
    const stats = await statsService.getExerciseStats(req.params.id, req.user.id, days);
    success(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function overviewStats(req, res, next) {
  try {
    const ALLOWED_DAYS = [7, 30, 90, 180, 365];
    const rawDays = parseInt(req.query.days) || 30;
    const days = ALLOWED_DAYS.includes(rawDays) ? rawDays : 30;
    const overview = await statsService.getOverviewStats(req.user.id, days);
    success(res, overview);
  } catch (err) {
    next(err);
  }
}
