import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireDispatchSafetyView } from '../middleware/dispatchMiddleware.js';
import { listLinkableFolders } from '../services/folderLinkService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireDispatchSafetyView);

router.get('/linkable', async (req, res, next) => {
  try {
    const folders = await listLinkableFolders(req.user, {
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    });
    res.json({ folders });
  } catch (err) {
    next(err);
  }
});

export default router;
