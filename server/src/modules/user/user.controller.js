import * as userService from './user.service.js';
import { success } from '../../lib/response.js';

export async function getProfile(req, res, next) {
  try {
    const profile = await userService.getProfile(req.user.id);
    success(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const profile = await userService.updateProfile(req.user.id, req.validatedBody);
    success(res, profile);
  } catch (err) {
    next(err);
  }
}
