import { Router } from 'express';
import auth from '../../middleware/auth.js';
import * as ctrl from './favorite.controller.js';

const router = Router();

router.get('/', auth, ctrl.listFavorites);
router.get('/ids', auth, ctrl.getFavoriteIds);
router.post('/:exerciseId', auth, ctrl.addFavorite);
router.delete('/:exerciseId', auth, ctrl.removeFavorite);

export default router;
