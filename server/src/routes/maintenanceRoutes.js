import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireMaintenanceAccess,
  requireMaintenanceEdit,
  requireMaintenanceDelete,
  requireMaintenanceCreate,
  requireMaintenanceInfoEdit,
} from '../middleware/maintenanceMiddleware.js';
import {
  listMaintenanceTags,
  ensureMaintenanceTag,
  formatTagRecord,
} from '../services/maintenanceTagService.js';
import {
  getMaintenanceTagUsage,
  deleteMaintenanceTagById,
  updateMaintenanceTagById,
} from '../services/maintenanceTagManageService.js';
import {
  listMaintenanceCases,
  getMaintenanceCaseById,
  createMaintenanceCase,
  updateMaintenanceCase,
  deleteMaintenanceCase,
  addMaintenanceCaseComment,
  addMaintenanceCaseAttachment,
  listMaintenanceAssignees,
  getMaintenanceCaseAttachmentFile,
} from '../services/maintenanceCaseService.js';
import { resolveFullPath } from '../config/storage.js';
import { createUploadFileFilter } from '../config/uploadTypes.js';
import { exportMaintenanceCostReport } from '../services/maintenanceCostReportService.js';
import {
  getMaintenanceInfoPage,
  updateMaintenanceInfoPage,
} from '../services/maintenanceInfoPageService.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: createUploadFileFilter(),
});

router.use(authMiddleware);
router.use(requireMaintenanceAccess);

router.get('/info-pages/:slug', async (req, res, next) => {
  try {
    const page = await getMaintenanceInfoPage(req.params.slug);
    res.json({ page });
  } catch (err) {
    next(err);
  }
});

router.put('/info-pages/:slug', requireMaintenanceInfoEdit, async (req, res, next) => {
  try {
    const page = await updateMaintenanceInfoPage(
      req.params.slug,
      req.body.content,
      req.user
    );
    res.json({ page });
  } catch (err) {
    next(err);
  }
});

router.get('/assignees', async (req, res, next) => {
  try {
    const assignees = await listMaintenanceAssignees(req.user);
    res.json({ assignees });
  } catch (err) {
    next(err);
  }
});

router.get('/tags/:type', async (req, res, next) => {
  try {
    const tags = await listMaintenanceTags(req.params.type);
    res.json({ tags: tags.map(formatTagRecord) });
  } catch (err) {
    next(err);
  }
});

router.post('/tags/:type', requireMaintenanceEdit, async (req, res, next) => {
  try {
    const tag = await ensureMaintenanceTag(
      req.params.type,
      req.body.name,
      req.user._id,
      req.body.color
    );
    res.status(201).json({ tag: formatTagRecord(tag) });
  } catch (err) {
    next(err);
  }
});

router.get('/tags/by-id/:id/usage', requireMaintenanceEdit, async (req, res, next) => {
  try {
    const { tag, count } = await getMaintenanceTagUsage(req.params.id);
    res.json({ tag: formatTagRecord(tag), count });
  } catch (err) {
    next(err);
  }
});

router.delete('/tags/by-id/:id', requireMaintenanceEdit, async (req, res, next) => {
  try {
    const result = await deleteMaintenanceTagById(req.params.id, req.body, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/tags/by-id/:id', requireMaintenanceEdit, async (req, res, next) => {
  try {
    const tag = await updateMaintenanceTagById(req.params.id, req.body, req.user._id);
    res.json({ tag: formatTagRecord(tag) });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/cost-export', async (req, res, next) => {
  try {
    const result = await exportMaintenanceCostReport(req.query);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.body);
  } catch (err) {
    next(err);
  }
});

router.get('/cases', async (req, res, next) => {
  try {
    const result = await listMaintenanceCases({
      ...req.query,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/cases/:id', async (req, res, next) => {
  try {
    const maintenanceCase = await getMaintenanceCaseById(req.params.id);
    res.json({ case: maintenanceCase });
  } catch (err) {
    next(err);
  }
});

router.post('/cases', requireMaintenanceCreate, async (req, res, next) => {
  try {
    const maintenanceCase = await createMaintenanceCase(req.body, req.user);
    res.status(201).json({ case: maintenanceCase });
  } catch (err) {
    next(err);
  }
});

router.patch('/cases/:id', requireMaintenanceEdit, async (req, res, next) => {
  try {
    const maintenanceCase = await updateMaintenanceCase(req.params.id, req.body, req.user);
    res.json({ case: maintenanceCase });
  } catch (err) {
    next(err);
  }
});

router.delete('/cases/:id', requireMaintenanceDelete, async (req, res, next) => {
  try {
    const result = await deleteMaintenanceCase(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/cases/:id/comments', requireMaintenanceEdit, async (req, res, next) => {
  try {
    const maintenanceCase = await addMaintenanceCaseComment(
      req.params.id,
      req.body.text,
      req.user
    );
    res.json({ case: maintenanceCase });
  } catch (err) {
    next(err);
  }
});

router.get('/cases/:id/attachments/:fileId/download', async (req, res, next) => {
  try {
    const file = await getMaintenanceCaseAttachmentFile(req.params.id, req.params.fileId);
    res.download(resolveFullPath(file.relativePath), file.originalName);
  } catch (err) {
    next(err);
  }
});

router.post('/cases/:id/attachments', requireMaintenanceAccess, (req, res, next) => {
  upload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return next(uploadErr);
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'File is required' });
      }
      const maintenanceCase = await addMaintenanceCaseAttachment(
        req.params.id,
        req.file,
        req.user
      );
      res.status(201).json({ case: maintenanceCase });
    } catch (err) {
      next(err);
    }
  });
});

export default router;
