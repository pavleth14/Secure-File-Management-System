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
  updateLeadStatus,
  formatStatusRecord,
} from '../services/leadStatusService.js';
import {
  auditLeadStatusCreated,
  auditLeadStatusDeleted,
  auditLeadStatusUpdated,
} from '../services/recruitingAuditService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRecruitingAccess);

router.get('/', async (_req, res, next) => {
  try {
    const statuses = await listLeadStatuses();
    res.json({
      statuses: statuses.map(formatStatusRecord),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRecruitingManager, async (req, res, next) => {
  try {
    const { name, isActive } = req.body;
    const status = await addLeadStatus(name, req.user._id, isActive);
    await auditLeadStatusCreated({
      user: req.user,
      statusName: status.name,
      isActive: status.isActive,
      req,
    });
    res.status(201).json({ status: formatStatusRecord(status) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRecruitingManager, async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const { status, previousIsActive } = await updateLeadStatus(req.params.id, { isActive });
    await auditLeadStatusUpdated({
      user: req.user,
      statusName: status.name,
      oldValues: { isActive: previousIsActive },
      newValues: { isActive: status.isActive },
      req,
    });
    res.json({ status: formatStatusRecord(status) });
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
