import { Group } from '../models/Group.js';
import { Folder } from '../models/Folder.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';

export async function getRootFolderId(folderId) {
  let current = await Folder.findById(folderId);
  if (!current) return null;

  while (current.parentFolderId) {
    current = await Folder.findById(current.parentFolderId);
    if (!current) return null;
  }
  return current._id;
}

export async function getRootFolder(folderId) {
  let current = await Folder.findById(folderId);
  if (!current) return null;

  while (current.parentFolderId) {
    current = await Folder.findById(current.parentFolderId);
    if (!current) return null;
  }
  return current;
}

function permissionMatches(perm, rootFolderId, targetFolderId) {
  const permRoot = perm.folderId.toString();
  const rootId = rootFolderId.toString();
  const targetId = targetFolderId.toString();

  if (permRoot !== rootId) return false;

  if (!perm.subfolderId) {
    return true;
  }

  return perm.subfolderId.toString() === targetId;
}

export function hasAction(permissions, rootFolderId, targetFolderId, action) {
  return permissions.some(
    (perm) =>
      permissionMatches(perm, rootFolderId, targetFolderId) &&
      perm.allowedActions.includes(action)
  );
}

export async function checkGroupPermission(user, folderId, action, subfolderId = null) {
  if (user.role === ROLES.SUPER_ADMIN) {
    return { allowed: true };
  }

  const targetFolderId = subfolderId || folderId;
  const rootFolder = await getRootFolder(folderId);
  if (!rootFolder) {
    return { allowed: false, message: 'Folder not found' };
  }

  if (!user.groupId) {
    return { allowed: false, message: 'User has no group assigned' };
  }

  const group = await Group.findById(user.groupId);
  if (!group) {
    return { allowed: false, message: 'Group not found' };
  }

  const allowed = hasAction(
    group.permissions,
    rootFolder._id,
    targetFolderId,
    action
  );

  if (!allowed) {
    return { allowed: false, message: 'Permission denied' };
  }

  return { allowed: true, group, rootFolder };
}

export async function getAccessibleFolderIds(user) {
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    const folders = await Folder.find({ isRoot: true });
    return folders.map((f) => f._id.toString());
  }

  if (!user.groupId) return [];

  const group = await Group.findById(user.groupId);
  if (!group) return [];

  const folderIds = new Set();
  for (const perm of group.permissions) {
    if (perm.allowedActions.includes(PERMISSIONS.READ)) {
      folderIds.add(perm.folderId.toString());
    }
  }

  return Array.from(folderIds);
}

export async function getUserPermissionsForFolder(user, folderId) {
  if (user.role === ROLES.SUPER_ADMIN) {
    return Object.values(PERMISSIONS);
  }

  const rootFolder = await getRootFolder(folderId);
  if (!rootFolder) return [];

  if (user.role === ROLES.ADMIN) {
    return [
      PERMISSIONS.READ,
      PERMISSIONS.UPLOAD,
      PERMISSIONS.DOWNLOAD,
      PERMISSIONS.EDIT,
      PERMISSIONS.DELETE,
      PERMISSIONS.MOVE,
    ];
  }

  if (!user.groupId) return [];

  const group = await Group.findById(user.groupId);
  if (!group) return [];

  const targetId = folderId.toString();
  const actions = new Set();

  for (const perm of group.permissions) {
    if (perm.folderId.toString() !== rootFolder._id.toString()) continue;

    const matches =
      !perm.subfolderId || perm.subfolderId.toString() === targetId;

    if (matches) {
      perm.allowedActions.forEach((a) => actions.add(a));
    }
  }

  return Array.from(actions);
}
