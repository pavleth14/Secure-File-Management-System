import multer from 'multer';
import path from 'path';
import { sanitizeName } from './storage.js';
import { resolveMyFilesUploadDir } from '../services/storageService.js';

export function createMyFilesUploadMiddleware() {
  const storage = multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const { fullPath } = await resolveMyFilesUploadDir(req.user._id);
        cb(null, fullPath);
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, file, cb) => {
      try {
        const storedName = sanitizeName(
          path.basename(file.originalname.replace(/\\/g, '/'))
        );
        cb(null, storedName);
      } catch (err) {
        cb(err);
      }
    },
  });

  return multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}
