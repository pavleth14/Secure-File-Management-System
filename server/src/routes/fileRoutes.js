import { Router } from 'express';
import { createReadStream } from 'fs';
import { FileModel } from '../models/File.js';
import { Folder } from '../models/Folder.js';
import { PERMISSIONS } from '../config/constants.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { aclFromFile } from '../middleware/aclMiddleware.js';
import { createUploadMiddleware } from '../config/multer.js';
import { checkGroupPermission, getRootFolder, filterSubfoldersForUser, canViewFolderContents } from '../services/aclService.js';
import { listFolderFiles } from '../services/searchService.js';
import { auditLog, buildActorLabel } from '../services/auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';
import {
  buildFileRelativePath,
  buildFolderRelativePath,
  resolveFullPath,
  unlinkFile,
  pathExists,
} from '../services/storageService.js';

const router = Router();
const upload = createUploadMiddleware();

router.use(authMiddleware);

router.post('/upload', async (req, res, next) => {
  if (process.env.UPLOAD_TRACE === 'true') {
    console.log('[upload-trace] files/upload reached', {
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type'],
      origin: req.headers.origin,
    });
  }

  try {
    const parseBody = () =>
      new Promise((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    await parseBody();

    const folderId = req.body.folderId || req.query.folderId;
    const subfolderId = req.body.subfolderId || req.query.subfolderId || null;
    if (!folderId || !req.file) {
      return res.status(400).json({ message: 'folderId and file required' });
    }

    const root = await getRootFolder(folderId);
    const check = await checkGroupPermission(
      req.user,
      root._id,
      PERMISSIONS.UPLOAD,
      subfolderId || null
    );

    if (!check.allowed) {
      await unlinkFile(
        buildFileRelativePath(
          await buildFolderRelativePath(subfolderId || root._id),
          req.file.filename
        )
      );
      return res.status(403).json({ message: 'Upload permission denied' });
    }

    const canView = await canViewFolderContents(req.user, root._id, subfolderId || null);
    if (!canView) {
      await unlinkFile(
        buildFileRelativePath(
          await buildFolderRelativePath(subfolderId || root._id),
          req.file.filename
        )
      );
      return res.status(403).json({ message: 'Cannot upload files to this folder level' });
    }

    const targetFolderId = subfolderId || root._id;
    const folderRelativePath = await buildFolderRelativePath(targetFolderId);
    const storedName = req.file.filename;
    const relativePath = buildFileRelativePath(folderRelativePath, storedName);

    const fileRecord = await FileModel.create({
      filename: storedName,
      originalName: storedName,
      relativePath,
      folderId: root._id,
      subfolderId: subfolderId || null,
      uploadedBy: req.user._id,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    const populated = await FileModel.findById(fileRecord._id).populate(
      'uploadedBy',
      'name email'
    );

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.FILE_UPLOAD,
      category: AUDIT_CATEGORIES.UPLOAD,
      targetType: TARGET_TYPES.FILE,
      targetId: fileRecord._id,
      targetName: fileRecord.originalName,
      details: `${buildActorLabel(req.user)} uploaded file ${fileRecord.originalName}`,
      req,
    });

    res.status(201).json({ file: populated });
  } catch (err) {
    if (req.file?.filename && req.body?.folderId) {
      try {
        const root = await getRootFolder(req.body.folderId || req.query.folderId);
        const subfolderId = req.body.subfolderId || req.query.subfolderId || null;
        const targetFolderId = subfolderId || root?._id;
        if (targetFolderId) {
          const folderRelativePath = await buildFolderRelativePath(targetFolderId);
          await unlinkFile(buildFileRelativePath(folderRelativePath, req.file.filename));
        }
      } catch {
        // Best-effort cleanup after a failed upload.
      }
    }
    next(err);
  }
});

router.get('/preview/:id', aclFromFile(PERMISSIONS.READ), async (req, res, next) => {
  try {
    const file = req.fileRecord;
    const fullPath = resolveFullPath(file.relativePath);

    if (!(await pathExists(file.relativePath))) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.FILE_READ,
      category: AUDIT_CATEGORIES.READ,
      targetType: TARGET_TYPES.FILE,
      targetId: file._id,
      targetName: file.originalName,
      details: `${buildActorLabel(req.user)} viewed file ${file.originalName}`,
      req,
    });

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    createReadStream(fullPath).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.get('/download/:id', aclFromFile(PERMISSIONS.DOWNLOAD), async (req, res, next) => {
  try {
    const file = req.fileRecord;

    if (!(await pathExists(file.relativePath))) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.FILE_DOWNLOAD,
      category: AUDIT_CATEGORIES.DOWNLOAD,
      targetType: TARGET_TYPES.FILE,
      targetId: file._id,
      targetName: file.originalName,
      details: `${buildActorLabel(req.user)} downloaded file ${file.originalName}`,
      req,
    });

    res.download(resolveFullPath(file.relativePath), file.originalName);
  } catch (err) {
    next(err);
  }
});

router.get('/:folderId', async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const { subfolderId, q, sortBy, sortDir } = req.query;

    const result = await listFolderFiles(req.user, folderId, {
      subfolderId: subfolderId || null,
      search: q,
      sortBy,
      sortDir,
    });

    if (!result) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    if (result.forbidden) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const parentId = subfolderId || folderId;
    let subfolders = await Folder.find({ parentFolderId: parentId }).sort({ name: 1 });
    const root = await getRootFolder(folderId);
    if (root) {
      subfolders = await filterSubfoldersForUser(req.user, root._id, subfolders);
    }

    res.json({ files: result.files, subfolders, showContents: result.showContents });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', aclFromFile(PERMISSIONS.DELETE), async (req, res, next) => {
  try {
    const file = req.fileRecord;

    await unlinkFile(file.relativePath);

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.FILE_DELETE,
      category: AUDIT_CATEGORIES.DELETE,
      targetType: TARGET_TYPES.FILE,
      targetId: file._id,
      targetName: file.originalName,
      details: `${buildActorLabel(req.user)} deleted file ${file.originalName}`,
      req,
    });

    await FileModel.deleteOne({ _id: file._id });
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
