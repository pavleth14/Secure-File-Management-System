import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireRecruitingAccess,
  requireRecruitingManager,
} from '../middleware/recruitingMiddleware.js';
import {
  listLeadStatuses,
  addLeadStatus,
  deleteLeadStatus,
} from '../services/leadStatusService.js';
import { auditLeadStatusCreated, auditLeadStatusDeleted } from '../services/recruitingAuditService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRecruitingAccess);

router.get('/', async (_req, res, next) => {
  try {
    const statuses = await listLeadStatuses();
    res.json({
      statuses: statuses.map((status) => ({
        id: status._id,
        name: status.name,
        isDefault: status.isDefault,
        createdAt: status.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRecruitingManager, async (req, res, next) => {
  try {
    const { name } = req.body;
    const status = await addLeadStatus(name, req.user._id);
    await auditLeadStatusCreated({ user: req.user, statusName: status.name, req });
    res.status(201).json({
      status: {
        id: status._id,
        name: status.name,
        isDefault: status.isDefault,
        createdAt: status.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRecruitingManager, async (req, res, next) => {
  try {
    const status = await deleteLeadStatus(req.params.id);
    await auditLeadStatusDeleted({ user: req.user, statusName: status.name, req });
    res.json({ message: 'Status deleted', status: { id: status._id, name: status.name } });
  } catch (err) {
    next(err);
  }
});

export default router;
