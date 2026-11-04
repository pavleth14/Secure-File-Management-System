import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  buildRelativePath,
  resolveFullPath,
  sanitizeName,
} from '../config/storage.js';
import { assertValidMaintenanceInfoPageSlug } from '../config/maintenanceInfoPages.js';
import { canEditMaintenanceInfoPages } from '../utils/maintenancePermissions.js';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

function assertImageFile(file) {
  const original = file?.originalname || file?.name || 'image.png';
  const ext = path.extname(original).slice(1).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    const err = new Error('Only image files (png, jpg, gif, webp) are allowed');
    err.status = 400;
    throw err;
  }
  return ext;
}

function assetRelativePath(slug, storedName) {
  return buildRelativePath('maintenance', 'info-pages', slug, storedName);
}

export function buildMaintenanceInfoAssetUrl(slug, storedName) {
  return `/api/maintenance/info-pages/${slug}/assets/${encodeURIComponent(storedName)}`;
}

export async function saveMaintenanceInfoImage(slug, file, user) {
  if (!canEditMaintenanceInfoPages(user)) {
    const err = new Error('Only maintenance managers can upload info page images');
    err.status = 403;
    throw err;
  }
  const validSlug = assertValidMaintenanceInfoPageSlug(slug);
  if (!file?.buffer?.length) {
    const err = new Error('Image file is required');
    err.status = 400;
    throw err;
  }

  const ext = assertImageFile(file);
  const baseName = sanitizeName(path.basename(file.originalname || `image.${ext}`, path.extname(file.originalname || '')) || 'image');
  const storedName = sanitizeName(`${uuidv4().slice(0, 8)}-${baseName}.${ext}`);
  const relativePath = assetRelativePath(validSlug, storedName);
  const fullPath = resolveFullPath(relativePath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, file.buffer);

  return {
    url: buildMaintenanceInfoAssetUrl(validSlug, storedName),
    storedName,
  };
}

export async function getMaintenanceInfoAssetPath(slug, filename) {
  const validSlug = assertValidMaintenanceInfoPageSlug(slug);
  const storedName = sanitizeName(filename);
  const relativePath = assetRelativePath(validSlug, storedName);
  const fullPath = resolveFullPath(relativePath);
  try {
    await fs.access(fullPath);
  } catch {
    const err = new Error('Image not found');
    err.status = 404;
    throw err;
  }
  return { fullPath, storedName };
}
