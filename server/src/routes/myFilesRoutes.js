import { Router } from 'express';
import { createReadStream } from 'fs';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { createMyFilesUploadMiddleware } from '../config/myFilesMulter.js';
import { PersonalFile } from '../models/PersonalFile.js';
import {
  buildMyFilesRelativePath,
  resolveFullPath,
  unlinkFile,
  pathExists,
} from '../services/storageService.js';
import {
  assertMyFilesStorageLimit,
  findOwnedPersonalFile,
  serializePersonalFile,
} from '../services/myFilesService.js';
import { auditLog, buildActorLabel } from '../services/auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';

const router = Router();
const upload = createMyFilesUploadMiddleware();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { sortBy = 'date', sortDir = 'desc' } = req.query;
    const dir = sortDir === 'asc' ? 1 : -1;
    const sortMap = {
      name: 'name',
      size: 'size',
      date: 'createdAt',
    };
    const sortField = sortMap[sortBy] || 'createdAt';

    const files = await PersonalFile.find({ userId: req.user._id }).sort({
      [sortField]: dir,
    });

    res.json({ files: files.map(serializePersonalFile) });
  } catch (err) {
    next(err);
  }
});

router.post('/upload', async (req, res, next) => {
  if (process.env.UPLOAD_TRACE === 'true') {
    console.log('[upload-trace] my-files/upload reached', {
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type'],
      origin: req.headers.origin,
    });
  }

  try {
    await new Promise((resolve, reject) => {
      upload.single('file')(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      return res.status(400).json({ message: 'File required' });
    }

    await assertMyFilesStorageLimit(req.user._id, req.file.size);

    const storedName = req.file.filename;
    const relativePath = buildMyFilesRelativePath(req.user._id, storedName);

    const fileRecord = await PersonalFile.create({
      name: storedName,
      relativePath,
      userId: req.user._id,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.MY_FILE_UPLOAD,
      category: AUDIT_CATEGORIES.UPLOAD,
      targetType: TARGET_TYPES.PERSONAL_FILE,
      targetId: fileRecord._id,
      targetName: fileRecord.name,
      details: `${buildActorLabel(req.user)} uploaded personal file ${fileRecord.name}`,
      req,
    });

    res.status(201).json({ file: serializePersonalFile(fileRecord) });
  } catch (err) {
    if (req.file?.filename) {
      try {
        await unlinkFile(buildMyFilesRelativePath(req.user._id, req.file.filename));
      } catch {
        // Best-effort cleanup after a failed upload.
      }
    }
    next(err);
  }
});

router.get('/preview/:id', async (req, res, next) => {
  try {
    const file = await findOwnedPersonalFile(req.user._id, req.params.id);

    if (!(await pathExists(file.relativePath))) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.MY_FILE_READ,
      category: AUDIT_CATEGORIES.READ,
      targetType: TARGET_TYPES.PERSONAL_FILE,
      targetId: file._id,
      targetName: file.name,
      details: `${buildActorLabel(req.user)} viewed personal file ${file.name}`,
      req,
    });

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    createReadStream(resolveFullPath(file.relativePath)).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.get('/download/:id', async (req, res, next) => {
  try {
    const file = await findOwnedPersonalFile(req.user._id, req.params.id);

    if (!(await pathExists(file.relativePath))) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.MY_FILE_DOWNLOAD,
      category: AUDIT_CATEGORIES.DOWNLOAD,
      targetType: TARGET_TYPES.PERSONAL_FILE,
      targetId: file._id,
      targetName: file.name,
      details: `${buildActorLabel(req.user)} downloaded personal file ${file.name}`,
      req,
    });

    res.download(resolveFullPath(file.relativePath), file.name);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const file = await findOwnedPersonalFile(req.user._id, req.params.id);

    await unlinkFile(file.relativePath);

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.MY_FILE_DELETE,
      category: AUDIT_CATEGORIES.DELETE,
      targetType: TARGET_TYPES.PERSONAL_FILE,
      targetId: file._id,
      targetName: file.name,
      details: `${buildActorLabel(req.user)} deleted personal file ${file.name}`,
      req,
    });

    await PersonalFile.deleteOne({ _id: file._id });
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
