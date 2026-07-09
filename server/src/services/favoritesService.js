import { Favorite } from '../models/Favorite.js';
import { FileModel } from '../models/File.js';
import { PersonalFile } from '../models/PersonalFile.js';
import { Folder } from '../models/Folder.js';
import { FILE_SOURCE_TYPES } from '../config/constants.js';
import { checkGroupPermission, getRootFolder } from './aclService.js';
import { PERMISSIONS } from '../config/constants.js';
import { serializePersonalFile } from './myFilesService.js';
import { findOwnedPersonalFolder } from './personalFolderService.js';

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

async function assertPersonalFolderAccess(user, folderId) {
  const folder = await findOwnedPersonalFolder(user._id, folderId);
  return {
    name: folder.name,
    folderId: folder._id,
    parentFolderId: folder.parentFolderId,
  };
}

async function assertFolderAccess(user, folderId) {
  const folder = await Folder.findById(folderId);
  if (!folder) {
    throw Object.assign(new Error('Folder not found'), { status: 404 });
  }

  const rootFolder = await getRootFolder(folder._id);
  if (!rootFolder) {
    throw Object.assign(new Error('Folder not found'), { status: 404 });
  }

  const check = await checkGroupPermission(
    user,
    rootFolder._id,
    PERMISSIONS.READ,
    folder.isRoot ? null : folder._id
  );

  if (!check.allowed) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  return {
    name: folder.name,
    isRoot: folder.isRoot,
    rootFolderId: rootFolder._id,
    folderId: folder._id,
  };
}

export async function toggleFavorite(user, fileType, fileId) {
  if (!Object.values(FILE_SOURCE_TYPES).includes(fileType)) {
    throw Object.assign(new Error('Invalid file type'), { status: 400 });
  }

  if (fileType === FILE_SOURCE_TYPES.FOLDER) {
    await assertFolderAccess(user, fileId);
  } else if (fileType === FILE_SOURCE_TYPES.PERSONAL_FOLDER) {
    await assertPersonalFolderAccess(user, fileId);
  } else {
    await assertFileAccess(user, fileType, fileId);
  }

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
      if (favorite.fileType === FILE_SOURCE_TYPES.FOLDER) {
        const folder = await assertFolderAccess(user, favorite.fileId);
        items.push({
          favoriteId: favorite._id,
          fileType: favorite.fileType,
          fileId: favorite.fileId,
          kind: 'folder',
          name: folder.name,
          favoritedAt: favorite.createdAt,
          isRoot: folder.isRoot,
          rootFolderId: folder.rootFolderId,
        });
        continue;
      }

      if (favorite.fileType === FILE_SOURCE_TYPES.PERSONAL_FOLDER) {
        const folder = await assertPersonalFolderAccess(user, favorite.fileId);
        items.push({
          favoriteId: favorite._id,
          fileType: favorite.fileType,
          fileId: favorite.fileId,
          kind: 'folder',
          name: folder.name,
          favoritedAt: favorite.createdAt,
          isPersonal: true,
          parentFolderId: folder.parentFolderId,
        });
        continue;
      }

      const file = await assertFileAccess(user, favorite.fileType, favorite.fileId);
      items.push({
        favoriteId: favorite._id,
        fileType: favorite.fileType,
        fileId: favorite.fileId,
        kind: 'file',
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
