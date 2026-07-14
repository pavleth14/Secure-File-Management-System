import { PersonalFolder } from '../models/PersonalFolder.js';
import { PersonalFile } from '../models/PersonalFile.js';
import {
  sanitizeName,
  buildRelativePath,
  createFolderOnDisk,
  removeFromDisk,
  renameOnDisk,
} from './storageService.js';
import { replaceRelativePathPrefix } from '../config/storage.js';

export const MY_FILES_VIRTUAL_ROOT_ID = 'my-files-root';

export function getMyFilesVirtualRoot() {
  return { _id: MY_FILES_VIRTUAL_ROOT_ID, name: 'My Files' };
}

export async function findOwnedPersonalFolder(userId, folderId) {
  const folder = await PersonalFolder.findOne({ _id: folderId, userId });
  if (!folder) {
    throw Object.assign(new Error('Folder not found'), { status: 404 });
  }
  return folder;
}

export async function getPersonalFoldersTree(userId) {
  const folders = await PersonalFolder.find({ userId }).sort({ name: 1 }).lean();

  const enriched = await Promise.all(
    folders.map(async (folder) => {
      const fileCount = await PersonalFile.countDocuments({
        userId,
        personalFolderId: folder._id,
      });
      return { ...folder, hasFiles: fileCount > 0 };
    })
  );

  return {
    root: getMyFilesVirtualRoot(),
    subfolders: enriched,
  };
}

export async function listPersonalFolderChildren(userId, personalFolderId = null) {
  const folderQuery = personalFolderId
    ? { userId, parentFolderId: personalFolderId }
    : { userId, parentFolderId: null };

  const subfolders = await PersonalFolder.find(folderQuery).sort({ name: 1 }).lean();
  return subfolders;
}

export async function createPersonalFolder(userId, name, parentFolderId = null) {
  const folderName = sanitizeName(name);

  if (!folderName) {
    throw Object.assign(new Error('Folder name required'), { status: 400 });
  }

  if (parentFolderId) {
    await findOwnedPersonalFolder(userId, parentFolderId);
  }

  const duplicateQuery = {
    userId,
    name: folderName,
    parentFolderId: parentFolderId || null,
  };

  const existing = await PersonalFolder.findOne(duplicateQuery);
  if (existing) {
    throw Object.assign(new Error('A folder with this name already exists here'), {
      status: 400,
    });
  }

  let relativePath;
  if (!parentFolderId) {
    relativePath = buildRelativePath('myfiles', userId.toString(), folderName);
  } else {
    const parent = await findOwnedPersonalFolder(userId, parentFolderId);
    relativePath = buildRelativePath(parent.relativePath, folderName);
  }

  await createFolderOnDisk(relativePath);

  return PersonalFolder.create({
    name: folderName,
    userId,
    parentFolderId: parentFolderId || null,
    relativePath,
  });
}

export async function deletePersonalFolder(userId, folderId) {
  const folder = await findOwnedPersonalFolder(userId, folderId);

  const childCount = await PersonalFolder.countDocuments({
    userId,
    parentFolderId: folder._id,
  });

  if (childCount > 0) {
    throw Object.assign(new Error('Folder must be empty before deleting'), { status: 400 });
  }

  const fileCount = await PersonalFile.countDocuments({
    userId,
    personalFolderId: folder._id,
  });

  if (fileCount > 0) {
    throw Object.assign(new Error('Folder must be empty before deleting'), { status: 400 });
  }

  await removeFromDisk(folder.relativePath, true);
  await PersonalFolder.deleteOne({ _id: folder._id });
}

async function updatePersonalPathsAfterFolderRename(
  userId,
  folderId,
  oldRelativePath,
  newRelativePath
) {
  const descendants = await PersonalFolder.find({
    userId,
    relativePath: { $regex: `^${escapeRegex(oldRelativePath)}/` },
  });

  for (const descendant of descendants) {
    descendant.relativePath = replaceRelativePathPrefix(
      descendant.relativePath,
      oldRelativePath,
      newRelativePath
    );
    await descendant.save();
  }

  const files = await PersonalFile.find({
    userId,
    relativePath: { $regex: `^${escapeRegex(oldRelativePath)}/` },
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

export async function renamePersonalFolder(userId, folderId, name) {
  const folder = await findOwnedPersonalFolder(userId, folderId);
  const folderName = sanitizeName(name);

  if (!folderName) {
    throw Object.assign(new Error('Folder name required'), { status: 400 });
  }

  const duplicate = await PersonalFolder.findOne({
    userId,
    name: folderName,
    parentFolderId: folder.parentFolderId || null,
    _id: { $ne: folder._id },
  });

  if (duplicate) {
    throw Object.assign(new Error('A folder with this name already exists here'), {
      status: 409,
    });
  }

  const oldRelativePath = folder.relativePath;
  const parentRelativePath = oldRelativePath.includes('/')
    ? oldRelativePath.slice(0, oldRelativePath.lastIndexOf('/'))
    : '';
  const newRelativePath = parentRelativePath
    ? buildRelativePath(parentRelativePath, folderName)
    : buildRelativePath('myfiles', userId.toString(), folderName);

  if (oldRelativePath !== newRelativePath) {
    await renameOnDisk(oldRelativePath, newRelativePath);
    folder.name = folderName;
    folder.relativePath = newRelativePath;
    await folder.save();
    await updatePersonalPathsAfterFolderRename(
      userId,
      folder._id,
      oldRelativePath,
      newRelativePath
    );
  }

  return folder;
}
