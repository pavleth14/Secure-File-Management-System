import multer from 'multer';
import path from 'path';

export function createRecruitingImportUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.csv') {
        cb(null, true);
        return;
      }
      cb(Object.assign(new Error('Only CSV files are allowed'), { status: 400 }));
    },
  });
}
