import { FileModel } from '../models/File.js';
import { Folder } from '../models/Folder.js';
import {
  getAccessibleFolderIds,
  checkGroupPermission,
  getRootFolder,
  canViewFolderContents,
} from './aclService.js';
import { PERMISSIONS } from '../config/constants.js';
import { buildMongoSort, needsInMemorySort, sortFiles } from '../utils/fileSort.js';

export { sortFiles } from '../utils/fileSort.js';

export async function listFolderFiles(user, rootFolderId, options = {}) {
  const { subfolderId, search, sortBy, sortDir } = options;

  const folder = await Folder.findById(rootFolderId);
  if (!folder) return null;

  const root = await getRootFolder(rootFolderId);
  const check = await checkGroupPermission(
    user,
    root._id,
    PERMISSIONS.READ,
    subfolderId || (folder.isRoot ? null : rootFolderId)
  );

  if (!check.allowed) {
    return { forbidden: true };
  }

  const showContents = await canViewFolderContents(user, root._id, subfolderId || null);

  const query = { folderId: root._id };
  if (subfolderId) {
    query.subfolderId = subfolderId;
  } else if (!folder.isRoot) {
    query.subfolderId = rootFolderId;
  } else {
    query.subfolderId = null;
  }

  if (search?.trim()) {
    query.originalName = { $regex: search.trim(), $options: 'i' };
  }

  let files = [];
  if (showContents) {
    files = await FileModel.find(query)
      .populate('uploadedBy', 'name email')
      .sort(buildMongoSort(sortBy, sortDir));

    if (needsInMemorySort(sortBy)) {
      files = sortFiles(files, sortBy, sortDir);
    }
  }

  return { files, folder, root, showContents };
}

export async function globalSearch(user, search, options = {}) {
  const q = search?.trim();
  if (!q) return [];

  const accessibleIds = await getAccessibleFolderIds(user);
  if (!accessibleIds.length) return [];

  const candidates = await FileModel.find({
    folderId: { $in: accessibleIds },
    originalName: { $regex: q, $options: 'i' },
  })
    .populate('uploadedBy', 'name email')
    .populate('folderId', 'name isRoot')
    .limit(200);

  const results = [];

  for (const file of candidates) {
    const check = await checkGroupPermission(
      user,
      file.folderId._id || file.folderId,
      PERMISSIONS.READ,
      file.subfolderId
    );
    if (!check.allowed) continue;

    const canView = await canViewFolderContents(
      user,
      file.folderId._id || file.folderId,
      file.subfolderId
    );
    if (!canView) continue;

    let subfolderName = null;
    if (file.subfolderId) {
      const sub = await Folder.findById(file.subfolderId);
      subfolderName = sub?.name || null;
    }

    results.push({
      ...file.toObject(),
      rootFolderName: file.folderId?.name,
      subfolderName,
      pathLabel: [file.folderId?.name, subfolderName].filter(Boolean).join(' / '),
    });
  }

  return sortFiles(results, options.sortBy || 'date', options.sortDir || 'desc');
}
