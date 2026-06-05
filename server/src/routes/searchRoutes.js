import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { globalSearch } from '../services/searchService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { q, sortBy, sortDir } = req.query;
    if (!q?.trim()) {
      return res.status(400).json({ message: 'Search query (q) is required' });
    }

    const results = await globalSearch(req.user, q, { sortBy, sortDir });
    res.json({ files: results });
  } catch (err) {
    next(err);
  }
});

export default router;
