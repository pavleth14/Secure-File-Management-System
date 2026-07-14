import { PersonalFile } from '../models/PersonalFile.js';
import { MY_FILES_STORAGE_LIMIT } from '../config/constants.js';
import {
  renameOnDisk,
  sanitizeName,
  pathExists,
} from './storageService.js';
import { buildRelativePath } from '../config/storage.js';

export function serializePersonalFile(file) {
  const doc = file.toObject ? file.toObject() : file;
  return {
    ...doc,
    originalName: doc.name,
    fileType: 'personal',
  };
}

export async function getMyFilesStorageUsed(userId) {
  const [result] = await PersonalFile.aggregate([
    { $match: { userId } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);

  return result?.total || 0;
}

export async function assertMyFilesStorageLimit(userId, incomingSize) {
  const used = await getMyFilesStorageUsed(userId);
  if (used + incomingSize > MY_FILES_STORAGE_LIMIT) {
    throw Object.assign(new Error('My Files storage limit exceeded (50GB)'), {
      status: 413,
    });
  }
}

export async function findOwnedPersonalFile(userId, fileId) {
  const file = await PersonalFile.findOne({ _id: fileId, userId });
  if (!file) {
    throw Object.assign(new Error('File not found'), { status: 404 });
  }
  return file;
}

export async function renamePersonalFile(userId, fileId, name) {
  const file = await findOwnedPersonalFile(userId, fileId);
  const newName = sanitizeName(name);

  if (!newName) {
    throw Object.assign(new Error('File name required'), { status: 400 });
  }

  if (newName === file.name) {
    return file;
  }

  const duplicate = await PersonalFile.findOne({
    userId,
    personalFolderId: file.personalFolderId ?? null,
    _id: { $ne: file._id },
    name: newName,
  });

  if (duplicate) {
    throw Object.assign(new Error('A file with this name already exists here'), {
      status: 409,
    });
  }

  const oldRelativePath = file.relativePath;
  const parentRelativePath = oldRelativePath.includes('/')
    ? oldRelativePath.slice(0, oldRelativePath.lastIndexOf('/'))
    : '';
  const newRelativePath = parentRelativePath
    ? buildRelativePath(parentRelativePath, newName)
    : buildRelativePath('myfiles', userId.toString(), newName);

  if (await pathExists(newRelativePath)) {
    throw Object.assign(new Error('A file with this name already exists here'), {
      status: 409,
    });
  }

  await renameOnDisk(oldRelativePath, newRelativePath);
  file.name = newName;
  file.relativePath = newRelativePath;
  await file.save();

  return file;
}
