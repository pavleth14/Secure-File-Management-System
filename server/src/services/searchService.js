import { FileModel } from '../models/File.js';
import { Folder } from '../models/Folder.js';
import {
  getAccessibleFolderIds,
  checkGroupPermission,
  getRootFolder,
} from './aclService.js';
import { PERMISSIONS } from '../config/constants.js';

function buildSort(sortBy = 'date', sortDir = 'desc') {
  const dir = sortDir === 'asc' ? 1 : -1;
  const map = {
    name: 'originalName',
    size: 'size',
    date: 'createdAt',
  };
  const field = map[sortBy] || 'createdAt';
  return { [field]: dir };
}

export function sortFiles(files, sortBy, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  const sorted = [...files];

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = (a.originalName || '').localeCompare(b.originalName || '');
        break;
      case 'size':
        cmp = (a.size || 0) - (b.size || 0);
        break;
      case 'uploadedBy': {
        const an = a.uploadedBy?.name || '';
        const bn = b.uploadedBy?.name || '';
        cmp = an.localeCompare(bn);
        break;
      }
      case 'date':
      default:
        cmp = new Date(a.createdAt) - new Date(b.createdAt);
        break;
    }
    return cmp * dir;
  });

  return sorted;
}

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

  let files = await FileModel.find(query)
    .populate('uploadedBy', 'name email')
    .sort(buildSort(sortBy, sortDir));

  if (sortBy === 'uploadedBy') {
    files = sortFiles(files, 'uploadedBy', sortDir);
  }

  return { files, folder, root };
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
