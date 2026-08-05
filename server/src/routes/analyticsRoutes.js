import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRecruitingAccess } from '../middleware/recruitingMiddleware.js';
import { getRecruitingAnalytics } from '../services/recruitingAnalyticsService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRecruitingAccess);

router.get('/', async (req, res, next) => {
  try {
    const analytics = await getRecruitingAnalytics(req.user, {
      from: req.query.from,
      to: req.query.to,
      driverTypeGroup: req.query.driverTypeGroup,
    });
    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

export default router;
