import { ROLES, PERMISSIONS, USER_FOLDER_DELETE_WINDOW_MS } from '../config/constants.js';
import { checkGroupPermission, getRootFolder } from './aclService.js';

export const FOLDER_DELETE_WINDOW_MESSAGE =
  'Folders created by Users can only be deleted within 24 hours of creation';

export function evaluateFolderDeletion(user, folder, hasDeletePermission) {
  if (!folder || folder.isRoot) {
    return { allowed: false, message: 'Cannot delete this folder' };
  }

  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    return { allowed: true };
  }

  if (!hasDeletePermission) {
    return { allowed: false, message: 'Permission denied' };
  }

  if (!folder.creatorRole || folder.creatorRole !== ROLES.USER) {
    return { allowed: true };
  }

  const creatorId = folder.createdBy?._id?.toString() || folder.createdBy?.toString();
  const requesterId = user._id?.toString();

  if (!creatorId || creatorId !== requesterId) {
    return {
      allowed: false,
      message: 'Only the folder creator can delete this folder within 24 hours of creation',
      reason: 'not_creator',
    };
  }

  const createdAt = folder.createdAt ? new Date(folder.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    return { allowed: false, message: FOLDER_DELETE_WINDOW_MESSAGE, reason: 'window_expired' };
  }

  const ageMs = Date.now() - createdAt.getTime();
  if (ageMs >= USER_FOLDER_DELETE_WINDOW_MS) {
    return {
      allowed: false,
      message: FOLDER_DELETE_WINDOW_MESSAGE,
      reason: 'window_expired',
    };
  }

  return { allowed: true };
}

export async function enrichSubfoldersWithDeletion(user, rootFolderId, subfolders) {
  return Promise.all(
    subfolders.map(async (folder) => {
      const folderObj = folder.toObject ? folder.toObject() : { ...folder };
      const deleteCheck = await checkGroupPermission(
        user,
        rootFolderId,
        PERMISSIONS.DELETE,
        folderObj._id
      );
      const deletion = evaluateFolderDeletion(user, folderObj, deleteCheck.allowed);

      return {
        ...folderObj,
        canDelete: deletion.allowed,
        deletionBlockedReason: deletion.allowed ? null : deletion.message,
      };
    })
  );
}

export async function assertFolderDeletionAllowed(user, folder) {
  const root = await getRootFolder(folder._id);
  const deleteCheck = await checkGroupPermission(
    user,
    root._id,
    PERMISSIONS.DELETE,
    folder._id
  );

  const hasDeletePermission =
    deleteCheck.allowed ||
    user.role === ROLES.SUPER_ADMIN ||
    user.role === ROLES.ADMIN;

  const deletion = evaluateFolderDeletion(user, folder, hasDeletePermission);

  if (!deletion.allowed) {
    throw Object.assign(new Error(deletion.message), {
      status: 403,
      reason: deletion.reason,
    });
  }

  return deletion;
}
