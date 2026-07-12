import * as templateService from './template.service.js';
import { success } from '../../lib/response.js';

export async function listTemplates(req, res, next) {
  try {
    const templates = await templateService.listTemplates(req.user.id);
    success(res, templates);
  } catch (err) {
    next(err);
  }
}

export async function getTemplate(req, res, next) {
  try {
    const template = await templateService.getTemplate(req.params.id, req.user.id);
    success(res, template);
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req, res, next) {
  try {
    const template = await templateService.createTemplate(req.validatedBody, req.user.id);
    success(res, template, 201);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    await templateService.deleteTemplate(req.params.id, req.user.id);
    success(res, { message: 'Template deleted.' });
  } catch (err) {
    next(err);
  }
}

export async function loadTemplateForWorkout(req, res, next) {
  try {
    const workoutData = await templateService.loadTemplateForWorkout(req.params.id, req.user.id);
    success(res, workoutData);
  } catch (err) {
    next(err);
  }
}
