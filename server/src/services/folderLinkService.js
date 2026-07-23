import { Folder } from '../models/Folder.js';
import { PERMISSIONS } from '../config/constants.js';
import {
  getAccessibleFolderIds,
  getRootFolder,
  checkGroupPermission,
  filterSubfoldersForUser,
} from './aclService.js';
import { getDescendantsFlat } from '../utils/folderTree.js';
import { filterBySearch } from './dispatchEntityHelpers.js';

export async function assertFolderLinkable(user, folderId) {
  if (!folderId) return null;

  const folder = await Folder.findById(folderId);
  if (!folder) {
    const err = new Error('Linked folder not found');
    err.status = 400;
    throw err;
  }

  const rootFolder = await getRootFolder(folder._id);
  const check = await checkGroupPermission(
    user,
    rootFolder._id,
    PERMISSIONS.READ,
    folder.isRoot ? null : folder._id
  );

  if (!check.allowed) {
    const err = new Error('You do not have access to link this folder');
    err.status = 403;
    throw err;
  }

  return folder;
}

export async function listLinkableFolders(user, { search, limit = 75 } = {}) {
  const accessibleRootIds = await getAccessibleFolderIds(user);
  const folders = [];
  const seen = new Set();

  for (const rootId of accessibleRootIds) {
    const root = await Folder.findById(rootId).select('name relativePath isRoot');
    if (!root || seen.has(root._id.toString())) continue;

    seen.add(root._id.toString());
    folders.push({
      id: root._id,
      name: root.name,
      relativePath: root.relativePath,
      isRoot: true,
    });

    const subfolders = await getDescendantsFlat(rootId);
    const visible = await filterSubfoldersForUser(user, rootId, subfolders);

    for (const subfolder of visible) {
      const id = subfolder._id.toString();
      if (seen.has(id)) continue;
      seen.add(id);

      const folderDoc = await Folder.findById(subfolder._id).select('name relativePath isRoot');
      if (!folderDoc) continue;

      folders.push({
        id: folderDoc._id,
        name: folderDoc.name,
        relativePath: folderDoc.relativePath,
        isRoot: false,
      });
    }
  }

  folders.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const filtered = filterBySearch(folders, search, (folder) => [
    folder.name,
    folder.relativePath,
  ]);

  return filtered.slice(0, limit);
}
