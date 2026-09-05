import * as exerciseService from './exercise.service.js';
import { success, error } from '../../lib/response.js';

export async function listExercises(req, res, next) {
  try {
    const result = await exerciseService.listExercises(req.validatedQuery, req.user.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getExercise(req, res, next) {
  try {
    const exercise = await exerciseService.getExercise(req.params.id, req.user.id);
    success(res, exercise);
  } catch (err) {
    next(err);
  }
}

export async function createExercise(req, res, next) {
  try {
    const exercise = await exerciseService.createExercise(req.validatedBody, req.user.id);
    success(res, exercise, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateExercise(req, res, next) {
  try {
    const exercise = await exerciseService.updateExercise(req.params.id, req.validatedBody, req.user.id);
    success(res, exercise);
  } catch (err) {
    next(err);
  }
}

export async function deleteExercise(req, res, next) {
  try {
    const result = await exerciseService.deleteExercise(req.params.id, req.user.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function filterOptions(_req, res, next) {
  try {
    const options = await exerciseService.getFilterOptions();
    success(res, options);
  } catch (err) {
    next(err);
  }
}
