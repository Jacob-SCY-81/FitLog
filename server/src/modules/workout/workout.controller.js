import * as workoutService from './workout.service.js';
import { success } from '../../lib/response.js';

export async function createWorkout(req, res, next) {
  try {
    const workout = await workoutService.createWorkout(req.validatedBody, req.user.id);
    success(res, workout, 201);
  } catch (err) {
    next(err);
  }
}

export async function listWorkouts(req, res, next) {
  try {
    const result = await workoutService.listWorkouts(req.validatedQuery, req.user.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getWorkout(req, res, next) {
  try {
    const workout = await workoutService.getWorkout(req.params.id, req.user.id);
    success(res, workout);
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkout(req, res, next) {
  try {
    await workoutService.deleteWorkout(req.params.id, req.user.id);
    success(res, { message: 'Workout deleted.' });
  } catch (err) {
    next(err);
  }
}

export async function updateWorkout(req, res, next) {
  try {
    const workout = await workoutService.updateWorkout(req.params.id, req.validatedBody, req.user.id);
    success(res, workout);
  } catch (err) {
    next(err);
  }
}
