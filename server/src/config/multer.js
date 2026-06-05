import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Folder } from '../models/Folder.js';
import { getRootFolder } from '../services/aclService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_BASE = path.join(__dirname, '../../uploads');

export async function resolveUploadDir(folderId, subfolderId) {
  const rootFolder = await getRootFolder(folderId);
  if (!rootFolder) {
    throw Object.assign(new Error('Folder not found'), { status: 404 });
  }

  let dir = path.join(UPLOADS_BASE, rootFolder.name);
  if (subfolderId) {
    const sub = await Folder.findById(subfolderId);
    if (sub) {
      dir = path.join(dir, sub.name);
    }
  }

  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
        const dir = await resolveUploadDir(folderId, subfolderId);
        cb(null, dir);
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
