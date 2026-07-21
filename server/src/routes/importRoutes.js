import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRecruitingImportAccess } from '../middleware/recruitingMiddleware.js';
import { createRecruitingImportUpload } from '../config/recruitingImportMulter.js';
import { previewLeadImport, confirmLeadImport } from '../services/leadImportService.js';
import { auditLeadImported } from '../services/recruitingAuditService.js';

const router = Router();
const upload = createRecruitingImportUpload();

router.use(authMiddleware);
router.use(requireRecruitingImportAccess);

router.post('/preview', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const assignedRecruiterId = req.body?.assignedRecruiterId || null;

    const result = await previewLeadImport(
      req.user,
      req.file.buffer,
      req.file.originalname || '',
      assignedRecruiterId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/confirm', async (req, res, next) => {
  try {
    const { previewId, selectedRowNumbers } = req.body;

    if (!previewId) {
      return res.status(400).json({ message: 'previewId is required' });
    }

    const result = await confirmLeadImport(req.user, previewId, selectedRowNumbers);
    if (result.imported > 0) {
      await auditLeadImported({ user: req.user, summary: result, req });
    }
    res.json({ summary: result });
  } catch (err) {
    next(err);
  }
});

export default router;
