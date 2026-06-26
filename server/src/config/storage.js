import path from 'path';

export const STORAGE_ROOT = process.env.STORAGE_ROOT || 'C:\\Uploads';

const INVALID_NAME_CHARS = /[\\/:*?"<>|\0]/g;

export function sanitizeName(name) {
  if (!name || typeof name !== 'string') {
    throw Object.assign(new Error('Invalid name'), { status: 400 });
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw Object.assign(new Error('Name cannot be empty'), { status: 400 });
  }

  const sanitized = trimmed.replace(INVALID_NAME_CHARS, '').replace(/\.\./g, '');
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw Object.assign(new Error('Invalid name'), { status: 400 });
  }

  return sanitized;
}

export function normalizeRelativePath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    throw Object.assign(new Error('Invalid relative path'), { status: 400 });
  }

  const segments = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) {
    throw Object.assign(new Error('Invalid relative path'), { status: 400 });
  }

  for (const segment of segments) {
    if (segment === '..') {
      throw Object.assign(new Error('Path traversal not allowed'), { status: 400 });
    }
    sanitizeName(segment);
  }

  return segments.join('/');
}

export function resolveFullPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split('/');
  const fullPath = path.resolve(STORAGE_ROOT, ...segments);
  const rootPath = path.resolve(STORAGE_ROOT);

  if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${path.sep}`)) {
    throw Object.assign(new Error('Path escapes storage root'), { status: 400 });
  }

  return fullPath;
}

export function buildRelativePath(...segments) {
  return normalizeRelativePath(segments.filter(Boolean).join('/'));
}

export function replaceRelativePathPrefix(relativePath, oldPrefix, newPrefix) {
  const normalized = normalizeRelativePath(relativePath);
  const normalizedOld = normalizeRelativePath(oldPrefix);
  const normalizedNew = normalizeRelativePath(newPrefix);

  if (normalized === normalizedOld) {
    return normalizedNew;
  }

  if (normalized.startsWith(`${normalizedOld}/`)) {
    return normalizeRelativePath(
      `${normalizedNew}/${normalized.slice(normalizedOld.length + 1)}`
    );
  }

  return normalized;
}
