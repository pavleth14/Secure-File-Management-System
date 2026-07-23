import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireDispatchModuleAccess,
  requireLoadEditAccess,
  requireLoadArchiveAccess,
  requireArchivedLoadsView,
  requireLoadCommentAccess,
} from '../middleware/dispatchMiddleware.js';
import {
  listLoads,
  listArchivedLoads,
  getLoadById,
  createLoad,
  updateLoad,
  archiveLoad,
  markLoadActive,
  markLoadDelivered,
  addLoadComment,
  editLoadComment,
  getLoadFormOptions,
  formatLoad,
} from '../services/loadService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireDispatchModuleAccess);

router.get('/options', async (_req, res, next) => {
  try {
    const options = await getLoadFormOptions();
    res.json(options);
  } catch (err) {
    next(err);
  }
});

router.get('/archived', requireArchivedLoadsView, async (req, res, next) => {
  try {
    const loads = await listArchivedLoads({
      search: req.query.search,
      user: req.user,
    });
    res.json({ loads });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const loads = await listLoads({
      search: req.query.search,
      status: req.query.status,
      user: req.user,
    });
    res.json({ loads });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const load = await getLoadById(req.params.id);
    res.json({ load: formatLoad(load, { user: req.user }) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireLoadEditAccess, async (req, res, next) => {
  try {
    const load = await createLoad(req.body, req.user);
    res.status(201).json({ load: formatLoad(load, { user: req.user }) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireLoadEditAccess, async (req, res, next) => {
  try {
    const load = await updateLoad(req.params.id, req.body, req.user);
    res.json({ load: formatLoad(load, { user: req.user }) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireLoadArchiveAccess, async (req, res, next) => {
  try {
    const load = await archiveLoad(req.params.id, req.user);
    res.json({ load: formatLoad(load, { user: req.user }) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/mark-active', requireLoadEditAccess, async (req, res, next) => {
  try {
    const load = await markLoadActive(req.params.id, req.user);
    res.json({ load: formatLoad(load, { user: req.user }) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/mark-delivered', requireLoadEditAccess, async (req, res, next) => {
  try {
    const load = await markLoadDelivered(req.params.id, req.user);
    res.json({ load: formatLoad(load, { user: req.user }) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comments', requireLoadCommentAccess, async (req, res, next) => {
  try {
    const load = await addLoadComment(req.user, req.params.id, req.body.text);
    res.json({ load: formatLoad(load, { user: req.user }) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/comments/:commentId', requireLoadCommentAccess, async (req, res, next) => {
  try {
    const load = await editLoadComment(
      req.user,
      req.params.id,
      req.params.commentId,
      req.body.text
    );
    res.json({ load: formatLoad(load, { user: req.user }) });
  } catch (err) {
    next(err);
  }
});

export default router;
