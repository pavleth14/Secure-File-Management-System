import { Folder } from '../models/Folder.js';
import { Truck } from '../models/Truck.js';
import { Trailer } from '../models/Trailer.js';
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

  if (!linkedFolderId) {
    return null;
  }

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
