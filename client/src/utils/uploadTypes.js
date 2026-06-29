export const BLOCKED_EXTENSIONS = new Set(['zip', 'bat']);

export function getFileExtension(filename) {
  const base = String(filename || '').replace(/\\/g, '/').split('/').pop() || '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx + 1).toLowerCase();
}

export function validateUploadFile(file) {
  const name = file?.name || file?.originalname || '';
  const ext = getFileExtension(name);

  if (!ext) {
    return { ok: false, message: 'File must have an extension' };
  }

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, message: `File type ".${ext}" is not allowed` };
  }

  return { ok: true, extension: ext };
}

export function partitionUploadFiles(files) {
  const accepted = [];
  const rejected = [];

  for (const file of files) {
    const result = validateUploadFile(file);
    if (result.ok) {
      accepted.push(file);
    } else {
      rejected.push({ file, message: result.message });
    }
  }

  return { accepted, rejected };
}
