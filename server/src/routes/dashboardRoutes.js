import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getDashboardData } from '../services/dashboardService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const data = await getDashboardData(req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
