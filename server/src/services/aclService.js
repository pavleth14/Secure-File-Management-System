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

function permRootFolderId(perm) {
  return (perm.folderId?._id || perm.folderId)?.toString?.() || null;
}

function permissionMatches(perm, rootFolderId, targetFolderId, permissions) {
  const permRoot = permRootFolderId(perm);
  const rootId = rootFolderId.toString();
  const targetId = targetFolderId.toString();

  if (!permRoot || permRoot !== rootId) return false;

  if (!perm.subfolderId) {
    if (hasSubfolderRestrictions(permissions, rootFolderId)) {
      return targetId === rootId;
    }
    return true;
  }

  return perm.subfolderId.toString() === targetId;
}

export function hasAction(permissions, rootFolderId, targetFolderId, action) {
  return permissions.some(
    (perm) =>
      permissionMatches(perm, rootFolderId, targetFolderId, permissions) &&
      perm.allowedActions.includes(action)
  );
}

export function hasSubfolderRestrictions(permissions, rootFolderId) {
  const rootId = rootFolderId.toString();
  return permissions.some(
    (perm) => permRootFolderId(perm) === rootId && perm.subfolderId
  );
}

function hasAnySubfolderRead(permissions, rootFolderId) {
  const rootId = rootFolderId.toString();
  return permissions.some(
    (perm) =>
      permRootFolderId(perm) === rootId &&
      perm.subfolderId &&
      perm.allowedActions.includes(PERMISSIONS.READ)
  );
}

function canReadFolder(permissions, rootFolderId, targetFolderId) {
  if (hasAction(permissions, rootFolderId, targetFolderId, PERMISSIONS.READ)) {
    return true;
  }

  const rootId = rootFolderId.toString();
  const targetId = targetFolderId.toString();

  if (targetId === rootId) {
    return hasAnySubfolderRead(permissions, rootFolderId);
  }

  return false;
}

export function findPermissionForContext(permissions, rootFolderId, targetFolderId) {
  const rootId = rootFolderId.toString();
  const targetId = targetFolderId.toString();

  const exactSubfolder = permissions.find(
    (perm) =>
      permRootFolderId(perm) === rootId &&
      perm.subfolderId?.toString() === targetId
  );
  if (exactSubfolder) return exactSubfolder;

  if (targetId === rootId) {
    return (
      permissions.find(
        (perm) => permRootFolderId(perm) === rootId && !perm.subfolderId
      ) || null
    );
  }

  if (!hasSubfolderRestrictions(permissions, rootFolderId)) {
    return (
      permissions.find(
        (perm) => permRootFolderId(perm) === rootId && !perm.subfolderId
      ) || null
    );
  }

  return null;
}

export async function canViewFolderContents(user, folderId, subfolderId = null) {
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    return true;
  }

  const rootFolder = await getRootFolder(folderId);
  if (!rootFolder) return false;

  const targetFolderId = subfolderId || rootFolder._id;
  const readCheck = await checkGroupPermission(
    user,
    rootFolder._id,
    PERMISSIONS.READ,
    subfolderId
  );
  if (!readCheck.allowed) return false;

  if (!user.groupId) return false;

  const group = await Group.findById(user.groupId);
  if (!group) return false;

  const perm = findPermissionForContext(
    group.permissions,
    rootFolder._id,
    targetFolderId
  );

  if (!perm) return true;

  return perm.showContents !== false;
}

export async function checkGroupPermission(user, folderId, action, subfolderId = null) {
  if (user.role === ROLES.SUPER_ADMIN) {
    return { allowed: true };
  }

  const rootFolder = await getRootFolder(folderId);
  if (!rootFolder) {
    return { allowed: false, message: 'Folder not found' };
  }

  const targetFolderId = subfolderId || rootFolder._id;

  if (user.role === ROLES.ADMIN) {
    return { allowed: true, rootFolder };
  }

  if (!user.groupId) {
    return { allowed: false, message: 'User has no group assigned' };
  }

  const group = await Group.findById(user.groupId);
  if (!group) {
    return { allowed: false, message: 'Group not found' };
  }

  const allowed =
    action === PERMISSIONS.READ
      ? canReadFolder(group.permissions, rootFolder._id, targetFolderId)
      : hasAction(
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
    if (!perm.allowedActions.includes(PERMISSIONS.READ)) continue;
    const rootId = permRootFolderId(perm);
    if (rootId) folderIds.add(rootId);
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
      PERMISSIONS.FOLDER_CREATE,
    ];
  }

  if (!user.groupId) return [];

  const group = await Group.findById(user.groupId);
  if (!group) return [];

  const targetId = folderId.toString();
  const rootId = rootFolder._id.toString();
  const actions = new Set();
  const restricted = hasSubfolderRestrictions(group.permissions, rootFolder._id);

  for (const perm of group.permissions) {
    if (permRootFolderId(perm) !== rootId) continue;

    if (!perm.subfolderId) {
      if (restricted) {
        if (targetId === rootId) {
          perm.allowedActions.forEach((action) => actions.add(action));
        }
      } else {
        perm.allowedActions.forEach((action) => actions.add(action));
      }
      continue;
    }

    if (perm.subfolderId.toString() === targetId) {
      perm.allowedActions.forEach((action) => actions.add(action));
    }
  }

  return Array.from(actions);
}

export async function filterSubfoldersForUser(user, rootFolderId, subfolders) {
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    return subfolders;
  }

  if (!user.groupId) return [];

  const group = await Group.findById(user.groupId);
  if (!group) return [];

  if (!hasSubfolderRestrictions(group.permissions, rootFolderId)) {
    return subfolders;
  }

  const readableIds = new Set();
  for (const subfolder of subfolders) {
    const check = await checkGroupPermission(
      user,
      rootFolderId,
      PERMISSIONS.READ,
      subfolder._id
    );
    if (check.allowed) {
      readableIds.add(subfolder._id.toString());
    }
  }

  if (readableIds.size === 0) {
    return [];
  }

  const rootId = rootFolderId.toString();
  const byId = new Map(
    subfolders.map((folder) => [folder._id.toString(), folder])
  );
  const visibleIds = new Set(readableIds);

  for (const subfolderId of readableIds) {
    let current = byId.get(subfolderId);
    while (current?.parentFolderId) {
      const parentId = current.parentFolderId.toString();
      visibleIds.add(parentId);
      if (parentId === rootId) break;
      current = byId.get(parentId);
    }
  }

  return subfolders.filter((folder) => visibleIds.has(folder._id.toString()));
}
