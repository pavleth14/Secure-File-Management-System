import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireDispatchSafetyView,
  requireSafetyEdit,
  requireSafetyDelete,
} from '../middleware/dispatchMiddleware.js';
import {
  listTrailers,
  getTrailerById,
  createTrailer,
  updateTrailer,
  deleteTrailer,
  formatTrailerResponse,
} from '../services/trailerService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireDispatchSafetyView);

router.get('/', async (req, res, next) => {
  try {
    const trailers = await listTrailers({
      search: req.query.search,
      status: req.query.status,
      user: req.user,
    });
    res.json({ trailers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const trailer = await getTrailerById(req.params.id);
    res.json({ trailer: formatTrailerResponse(trailer) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireSafetyEdit, async (req, res, next) => {
  try {
    const trailer = await createTrailer(req.body, req.user._id);
    res.status(201).json({ trailer: formatTrailerResponse(trailer) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireSafetyEdit, async (req, res, next) => {
  try {
    const trailer = await updateTrailer(req.params.id, req.body);
    res.json({ trailer: formatTrailerResponse(trailer) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireSafetyDelete, async (req, res, next) => {
  try {
    const result = await deleteTrailer(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
