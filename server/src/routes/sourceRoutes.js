import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireRecruitingAccess,
  requireRecruitingManager,
} from '../middleware/recruitingMiddleware.js';
import {
  listLeadSources,
  addLeadSource,
} from '../services/leadSourceService.js';
import { auditLeadSourceCreated } from '../services/recruitingAuditService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRecruitingAccess);

router.get('/', async (_req, res, next) => {
  try {
    const sources = await listLeadSources();
    res.json({
      sources: sources.map((source) => ({
        id: source._id,
        name: source.name,
        isDefault: source.isDefault,
        createdAt: source.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRecruitingManager, async (req, res, next) => {
  try {
    const { name } = req.body;
    const source = await addLeadSource(name, req.user._id);
    await auditLeadSourceCreated({ user: req.user, sourceName: source.name, req });
    res.status(201).json({
      source: {
        id: source._id,
        name: source.name,
        isDefault: source.isDefault,
        createdAt: source.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
