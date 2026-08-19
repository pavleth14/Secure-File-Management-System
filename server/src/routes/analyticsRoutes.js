import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRecruitingManager } from '../middleware/recruitingMiddleware.js';
import { getRecruitingAnalytics } from '../services/recruitingAnalyticsService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRecruitingManager);

router.get('/', async (req, res, next) => {
  try {
    const analytics = await getRecruitingAnalytics(req.user, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

export default router;
