import { PersonalFile } from '../models/PersonalFile.js';
import { MY_FILES_STORAGE_LIMIT } from '../config/constants.js';

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
