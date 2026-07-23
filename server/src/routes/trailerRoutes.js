import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireDispatchSafetyView,
  requireSafetyEdit,
  requireSafetyDelete,
  requireFolderLinkAccess,
} from '../middleware/dispatchMiddleware.js';
import {
  listTrailers,
  getTrailerById,
  createTrailer,
  updateTrailer,
  deleteTrailer,
  linkTrailerFolder,
  formatTrailerResponse,
} from '../services/trailerService.js';
import {
  auditTrailerCreated,
  auditTrailerUpdated,
  auditTrailerDeleted,
} from '../services/dispatchAuditService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireDispatchSafetyView);

function pickTrailerSnapshot(trailer) {
  return {
    trailerNumber: trailer.trailerNumber,
    type: trailer.type,
    status: trailer.status,
    size: trailer.size,
    make: trailer.make,
    model: trailer.model,
    linkedFolderId: trailer.linkedFolderId?.toString?.() || trailer.linkedFolderId,
  };
}

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
    const trailer = await createTrailer(req.body, req.user._id, req.user);
    await auditTrailerCreated({ user: req.user, trailer, req });
    res.status(201).json({ trailer: formatTrailerResponse(trailer) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireSafetyEdit, async (req, res, next) => {
  try {
    const before = await getTrailerById(req.params.id);
    const oldValues = pickTrailerSnapshot(before);
    const trailer = await updateTrailer(req.params.id, req.body, req.user);
    await auditTrailerUpdated({
      user: req.user,
      trailer,
      req,
      oldValues,
      newValues: pickTrailerSnapshot(trailer),
    });
    res.json({ trailer: formatTrailerResponse(trailer) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/folder', requireFolderLinkAccess, async (req, res, next) => {
  try {
    const trailer = await linkTrailerFolder(
      req.params.id,
      req.body.linkedFolderId ?? null,
      req.user,
      req
    );
    res.json({ trailer: formatTrailerResponse(trailer) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireSafetyDelete, async (req, res, next) => {
  try {
    const trailer = await getTrailerById(req.params.id);
    const result = await deleteTrailer(req.params.id);
    await auditTrailerDeleted({ user: req.user, trailer, req });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
