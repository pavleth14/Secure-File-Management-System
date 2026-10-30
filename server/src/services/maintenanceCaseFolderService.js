import { Folder } from '../models/Folder.js';
import { Truck } from '../models/Truck.js';
import { Trailer } from '../models/Trailer.js';
import { ROLES } from '../config/constants.js';

const FALLBACK_ROOT_FOLDER_NAME = 'Maintenance-Case-Files';
import {
  buildFolderRelativePath,
  createFolderOnDisk,
  buildRelativePath,
} from './storageService.js';
import { sanitizeName } from '../config/storage.js';

async function findOrCreateSubfolder(parentId, folderName, userId, userRole) {
  const safeName = sanitizeName(folderName);
  let folder = await Folder.findOne({ parentFolderId: parentId, name: safeName });
  if (folder) return folder;

  const parent = await Folder.findById(parentId);
  if (!parent) {
    const err = new Error('Parent folder not found');
    err.status = 404;
    throw err;
  }

  const parentRelativePath =
    parent.relativePath || (await buildFolderRelativePath(parent._id));
  const relativePath = buildRelativePath(parentRelativePath, safeName);

  folder = await Folder.create({
    name: safeName,
    relativePath,
    parentFolderId: parentId,
    isRoot: false,
    createdBy: userId,
    creatorRole: userRole,
  });
  await createFolderOnDisk(relativePath);
  return folder;
}

async function getOrCreateFallbackMaintenanceRoot(user) {
  let root = await Folder.findOne({ isRoot: true, name: FALLBACK_ROOT_FOLDER_NAME });
  if (root) return root;

  const relativePath = FALLBACK_ROOT_FOLDER_NAME;
  root = await Folder.create({
    name: FALLBACK_ROOT_FOLDER_NAME,
    relativePath,
    parentFolderId: null,
    isRoot: true,
    createdBy: user._id,
    creatorRole: user.role || ROLES.SUPER_ADMIN,
  });
  await createFolderOnDisk(relativePath);
  return root;
}

export async function ensureMaintenanceCaseFolder({ truckId, trailerId, caseId, user }) {
  let linkedFolderId = null;

  if (truckId) {
    const truck = await Truck.findById(truckId).select('linkedFolderId truckNumber');
    linkedFolderId = truck?.linkedFolderId || null;
  }

  if (!linkedFolderId && trailerId) {
    const trailer = await Trailer.findById(trailerId).select('linkedFolderId trailerNumber');
    linkedFolderId = trailer?.linkedFolderId || null;
  }

  if (linkedFolderId) {
    const maintenanceFolder = await findOrCreateSubfolder(
      linkedFolderId,
      'Maintenance',
      user._id,
      user.role
    );
    const caseFolder = await findOrCreateSubfolder(
      maintenanceFolder._id,
      String(caseId),
      user._id,
      user.role
    );
    return caseFolder._id;
  }

  const fallbackRoot = await getOrCreateFallbackMaintenanceRoot(user);
  const unassignedBucket = await findOrCreateSubfolder(
    fallbackRoot._id,
    'Unlinked-Equipment',
    user._id,
    user.role
  );
  const caseFolder = await findOrCreateSubfolder(
    unassignedBucket._id,
    String(caseId),
    user._id,
    user.role
  );
  return caseFolder._id;
}
