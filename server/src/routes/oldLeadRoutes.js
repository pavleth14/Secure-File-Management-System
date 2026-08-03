import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRecruitingManager } from '../middleware/recruitingMiddleware.js';
import { createRecruitingImportUpload } from '../config/recruitingImportMulter.js';
import { previewOldLeadImport, confirmOldLeadImport } from '../services/oldLeadImportService.js';
import {
  listOldLeads,
  assignOldLeadsToRecruiter,
  assignOldLeadsRoundRobin,
} from '../services/oldLeadService.js';
import {
  auditOldLeadImported,
  auditOldLeadAssigned,
  auditOldLeadsRoundRobinAssigned,
} from '../services/recruitingAuditService.js';

const router = Router();
const upload = createRecruitingImportUpload();

router.use(authMiddleware);
router.use(requireRecruitingManager);

router.get('/', async (req, res, next) => {
  try {
    const result = await listOldLeads({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      status: req.query.status,
      driverType: req.query.driverType,
      source: req.query.source,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      assignmentStatus: req.query.assignmentStatus,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/import/preview', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const result = await previewOldLeadImport(
      req.user,
      req.file.buffer,
      req.file.originalname || ''
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/import/confirm', async (req, res, next) => {
  try {
    const { previewId, selectedRowNumbers } = req.body;

    if (!previewId) {
      return res.status(400).json({ message: 'previewId is required' });
    }

    const result = await confirmOldLeadImport(req.user, previewId, selectedRowNumbers);
    if (result.imported > 0) {
      await auditOldLeadImported({ user: req.user, summary: result, req });
    }
    res.json({ summary: result });
  } catch (err) {
    next(err);
  }
});

router.post('/assign', async (req, res, next) => {
  try {
    const { oldLeadIds, recruiterId } = req.body;

    if (!recruiterId) {
      return res.status(400).json({ message: 'recruiterId is required' });
    }

    const result = await assignOldLeadsToRecruiter(req.user, oldLeadIds, recruiterId, req);

    for (const assignment of result.assignments) {
      await auditOldLeadAssigned({
        user: req.user,
        oldLead: assignment.oldLead,
        recruiterName: assignment.recruiterName,
        req,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/assign/round-robin', async (req, res, next) => {
  try {
    const { oldLeadIds } = req.body;
    const result = await assignOldLeadsRoundRobin(req.user, oldLeadIds, req);

    await auditOldLeadsRoundRobinAssigned({
      user: req.user,
      summary: {
        assigned: result.assigned,
        failed: result.failed,
        errors: result.errors,
      },
      req,
    });

    for (const assignment of result.assignments) {
      await auditOldLeadAssigned({
        user: req.user,
        oldLead: assignment.oldLead,
        recruiterName: assignment.recruiterName,
        req,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
