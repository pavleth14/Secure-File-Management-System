import multer from 'multer';
import path from 'path';
import { resolveUploadDir } from '../services/storageService.js';

export { STORAGE_ROOT } from '../config/storage.js';

export async function resolveUploadDirectory(folderId, subfolderId) {
  return resolveUploadDir(folderId, subfolderId);
}

export function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const folderId = req.body.folderId || req.query.folderId;
        const subfolderId = req.body.subfolderId || req.query.subfolderId || null;
        if (!folderId) {
          throw Object.assign(new Error('folderId is required'), { status: 400 });
        }
        const { fullPath } = await resolveUploadDir(folderId, subfolderId);
        cb(null, fullPath);
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${unique}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}
