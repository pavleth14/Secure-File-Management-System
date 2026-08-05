import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireRecruitingAccess,
  requireRecruitingManager,
} from '../middleware/recruitingMiddleware.js';
import {
  listRoundRobinSettings,
  updateRoundRobinSettings,
} from '../services/roundRobinService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRecruitingAccess);
router.use(requireRecruitingManager);

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await listRoundRobinSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const settings = await updateRoundRobinSettings(req.body?.recruiters);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

export default router;
