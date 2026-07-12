import * as favoriteService from './favorite.service.js';
import { success } from '../../lib/response.js';

export async function listFavorites(req, res, next) {
  try {
    const exercises = await favoriteService.listFavorites(req.user.id);
    success(res, exercises);
  } catch (err) {
    next(err);
  }
}

export async function addFavorite(req, res, next) {
  try {
    const fav = await favoriteService.addFavorite(req.params.exerciseId, req.user.id);
    success(res, fav, 201);
  } catch (err) {
    next(err);
  }
}

export async function removeFavorite(req, res, next) {
  try {
    await favoriteService.removeFavorite(req.params.exerciseId, req.user.id);
    success(res, { message: 'Favorite removed.' });
  } catch (err) {
    next(err);
  }
}

export async function getFavoriteIds(req, res, next) {
  try {
    const ids = await favoriteService.getFavoriteIds(req.user.id);
    success(res, ids);
  } catch (err) {
    next(err);
  }
}
