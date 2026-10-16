import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireMaintenanceAccess,
  requireMaintenanceEdit,
  requireMaintenanceDelete,
} from '../middleware/maintenanceMiddleware.js';
import {
  listMaintenanceTags,
  ensureMaintenanceTag,
  formatTagRecord,
} from '../services/maintenanceTagService.js';
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

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: createUploadFileFilter(),
});

router.use(authMiddleware);
router.use(requireMaintenanceAccess);

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

router.post('/cases', requireMaintenanceEdit, async (req, res, next) => {
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

router.post('/cases/:id/attachments', requireMaintenanceEdit, (req, res, next) => {
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
