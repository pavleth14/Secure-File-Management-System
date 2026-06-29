import path from 'path';

export const BLOCKED_EXTENSIONS = new Set(['zip', 'bat']);

export function getFileExtension(filename) {
  const base = path.basename(String(filename || '').replace(/\\/g, '/'));
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx + 1).toLowerCase();
}

export function validateUploadFile(file) {
  const name = file?.originalname || file?.name || '';
  const ext = getFileExtension(name);

  if (!ext) {
    return { ok: false, message: 'File must have an extension' };
  }

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, message: `File type ".${ext}" is not allowed` };
  }

  return { ok: true, extension: ext };
}

export function createUploadFileFilter() {
  return (_req, file, cb) => {
    const result = validateUploadFile(file);
    if (!result.ok) {
      cb(Object.assign(new Error(result.message), { status: 400 }));
      return;
    }
    cb(null, true);
  };
}
