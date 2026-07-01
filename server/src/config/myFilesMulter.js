import multer from 'multer';
import path from 'path';
import { sanitizeName } from './storage.js';
import { createUploadFileFilter } from './uploadTypes.js';
import { buildRelativePath, resolveMyFilesUploadDir } from '../services/storageService.js';

export function createMyFilesUploadMiddleware() {
  const storage = multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const personalFolderId = req.body.personalFolderId || null;
        const { fullPath, relativePath } = await resolveMyFilesUploadDir(
          req.user._id,
          personalFolderId || null
        );
        req.myFilesUploadRelativePath = relativePath;
        cb(null, fullPath);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      try {
        const storedName = sanitizeName(
          path.basename(file.originalname.replace(/\\/g, '/'))
        );
        const basePath = req.myFilesUploadRelativePath;
        file.relativePath = basePath
          ? buildRelativePath(basePath, storedName)
          : null;
        cb(null, storedName);
      } catch (err) {
        cb(err);
      }
    },
  });

  return multer({
    storage,
    fileFilter: createUploadFileFilter(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}
