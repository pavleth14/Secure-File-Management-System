import fs from 'fs/promises';
import path from 'path';
import { Folder } from '../models/Folder.js';
import { FileModel } from '../models/File.js';
import {
  STORAGE_ROOT,
  sanitizeName,
  resolveFullPath,
  buildRelativePath,
  replaceRelativePathPrefix,
} from '../config/storage.js';
import { getDescendantsFlat } from '../utils/folderTree.js';

export { STORAGE_ROOT, sanitizeName, resolveFullPath, buildRelativePath };

export async function ensureStorageRoot() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

export async function buildFolderRelativePath(folderId) {
  const segments = [];
  let current = await Folder.findById(folderId);

  if (!current) {
    throw Object.assign(new Error('Folder not found'), { status: 404 });
  }

  while (current) {
    segments.unshift(sanitizeName(current.name));
    if (!current.parentFolderId) break;
    current = await Folder.findById(current.parentFolderId);
    if (!current) break;
  }

  return buildRelativePath(...segments);
}

export async function resolveUploadDir(folderId, subfolderId = null) {
  const targetFolderId = subfolderId || folderId;
  const relativePath = await buildFolderRelativePath(targetFolderId);
  const fullPath = resolveFullPath(relativePath);

  await fs.mkdir(fullPath, { recursive: true });

  return { relativePath, fullPath };
}

export function buildFileRelativePath(folderRelativePath, filename) {
  return buildRelativePath(folderRelativePath, filename);
}

export async function createFolderOnDisk(relativePath) {
  const fullPath = resolveFullPath(relativePath);
  await fs.mkdir(fullPath, { recursive: true });
}

export async function renameOnDisk(oldRelativePath, newRelativePath) {
  const oldFullPath = resolveFullPath(oldRelativePath);
  const newFullPath = resolveFullPath(newRelativePath);

  try {
    await fs.access(oldFullPath);
  } catch {
    return;
  }

  await fs.mkdir(path.dirname(newFullPath), { recursive: true });
  await fs.rename(oldFullPath, newFullPath);
}

export async function removeFromDisk(relativePath, recursive = false) {
  const fullPath = resolveFullPath(relativePath);

  try {
    await fs.access(fullPath);
  } catch {
    return;
  }

  await fs.rm(fullPath, { recursive, force: true });
}

export async function pathExists(relativePath) {
  try {
    await fs.access(resolveFullPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function unlinkFile(relativePath) {
  const fullPath = resolveFullPath(relativePath);

  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export async function updateRelativePathsAfterFolderRename(
  folderId,
  oldRelativePath,
  newRelativePath
) {
  const descendants = await getDescendantsFlat(folderId);

  for (const descendant of descendants) {
    const folder = await Folder.findById(descendant._id);
    if (!folder?.relativePath) continue;

    folder.relativePath = replaceRelativePathPrefix(
      folder.relativePath,
      oldRelativePath,
      newRelativePath
    );
    await folder.save();
  }

  const files = await FileModel.find({
    relativePath: {
      $regex: `^${escapeRegex(oldRelativePath)}(/|$)`,
    },
  });

  for (const file of files) {
    file.relativePath = replaceRelativePathPrefix(
      file.relativePath,
      oldRelativePath,
      newRelativePath
    );
    await file.save();
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildMyFilesRelativePath(userId, filename, folderRelativePath = null) {
  if (folderRelativePath) {
    return buildRelativePath(folderRelativePath, filename);
  }
  return buildRelativePath('myfiles', userId.toString(), filename);
}

export async function resolveMyFilesUploadDir(userId, personalFolderId = null) {
  const { PersonalFolder } = await import('../models/PersonalFolder.js');
  let relativePath = buildRelativePath('myfiles', userId.toString());

  if (personalFolderId) {
    const folder = await PersonalFolder.findOne({ _id: personalFolderId, userId });
    if (!folder) {
      throw Object.assign(new Error('Folder not found'), { status: 404 });
    }
    relativePath = folder.relativePath;
  }

  const fullPath = resolveFullPath(relativePath);
  await fs.mkdir(fullPath, { recursive: true });
  return { relativePath, fullPath };
}
