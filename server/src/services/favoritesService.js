import { Favorite } from '../models/Favorite.js';
import { FileModel } from '../models/File.js';
import { PersonalFile } from '../models/PersonalFile.js';
import { FILE_SOURCE_TYPES } from '../config/constants.js';
import { checkGroupPermission } from './aclService.js';
import { PERMISSIONS } from '../config/constants.js';
import { serializePersonalFile } from './myFilesService.js';

function favoriteKey(fileType, fileId) {
  return `${fileType}:${fileId.toString()}`;
}

export async function getFavoriteKeys(userId) {
  const favorites = await Favorite.find({ userId }).select('fileType fileId');
  return favorites.map((f) => favoriteKey(f.fileType, f.fileId));
}

export async function isFavorite(userId, fileType, fileId) {
  const favorite = await Favorite.findOne({ userId, fileType, fileId });
  return Boolean(favorite);
}

async function assertFileAccess(user, fileType, fileId) {
  if (fileType === FILE_SOURCE_TYPES.PERSONAL) {
    const file = await PersonalFile.findOne({ _id: fileId, userId: user._id });
    if (!file) {
      throw Object.assign(new Error('File not found'), { status: 404 });
    }
    return serializePersonalFile(file);
  }

  const file = await FileModel.findById(fileId).populate('folderId', 'name isRoot');
  if (!file) {
    throw Object.assign(new Error('File not found'), { status: 404 });
  }

  const check = await checkGroupPermission(
    user,
    file.folderId._id || file.folderId,
    PERMISSIONS.READ,
    file.subfolderId
  );

  if (!check.allowed) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  return {
    ...file.toObject(),
    fileType: FILE_SOURCE_TYPES.GROUP,
  };
}

export async function toggleFavorite(user, fileType, fileId) {
  if (!Object.values(FILE_SOURCE_TYPES).includes(fileType)) {
    throw Object.assign(new Error('Invalid file type'), { status: 400 });
  }

  await assertFileAccess(user, fileType, fileId);

  const existing = await Favorite.findOne({
    userId: user._id,
    fileType,
    fileId,
  });

  if (existing) {
    await Favorite.deleteOne({ _id: existing._id });
    return { favorited: false };
  }

  await Favorite.create({
    userId: user._id,
    fileType,
    fileId,
  });

  return { favorited: true };
}

export async function listFavorites(user) {
  const favorites = await Favorite.find({ userId: user._id }).sort({ createdAt: -1 });
  const items = [];

  for (const favorite of favorites) {
    try {
      const file = await assertFileAccess(user, favorite.fileType, favorite.fileId);
      items.push({
        favoriteId: favorite._id,
        fileType: favorite.fileType,
        fileId: favorite.fileId,
        name: file.originalName || file.name,
        size: file.size,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        favoritedAt: favorite.createdAt,
        folderId: file.folderId?._id || file.folderId || null,
        subfolderId: file.subfolderId || null,
      });
    } catch {
      await Favorite.deleteOne({ _id: favorite._id });
    }
  }

  return items;
}
