import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { FILE_SOURCE_TYPES } from '../config/constants.js';
import {
  getFavoriteKeys,
  toggleFavorite,
  listFavorites,
} from '../services/favoritesService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const favorites = await listFavorites(req.user);
    res.json({ favorites });
  } catch (err) {
    next(err);
  }
});

router.get('/ids', async (req, res, next) => {
  try {
    const keys = await getFavoriteKeys(req.user._id);
    res.json({ favorites: keys });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { fileType, fileId } = req.body;

    if (!fileType || !fileId) {
      return res.status(400).json({ message: 'fileType and fileId required' });
    }

    if (!Object.values(FILE_SOURCE_TYPES).includes(fileType)) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    const result = await toggleFavorite(req.user, fileType, fileId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
