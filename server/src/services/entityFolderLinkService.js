import { assertFolderLinkable } from './folderLinkService.js';
import { TARGET_TYPES } from '../config/auditConstants.js';
import {
  auditEntityFolderLinked,
  auditEntityFolderUnlinked,
} from './dispatchAuditService.js';

export async function linkEntityFolder({
  getEntityById,
  entityId,
  linkedFolderId,
  user,
  req,
  entityType,
  getEntityName,
}) {
  const entity = await getEntityById(entityId);
  const oldFolderId = entity.linkedFolderId?._id?.toString() || entity.linkedFolderId?.toString() || null;
  const nextFolderId = linkedFolderId || null;

  if (nextFolderId === oldFolderId) {
    return entity;
  }

  let folder = null;
  if (nextFolderId) {
    folder = await assertFolderLinkable(user, nextFolderId);
  }

  entity.linkedFolderId = nextFolderId;
  await entity.save();

  const entityName = getEntityName(entity);
  if (nextFolderId) {
    await auditEntityFolderLinked({
      user,
      entityType,
      entityId: entity._id,
      entityName,
      folderId: nextFolderId,
      folderPath: folder?.relativePath || null,
      req,
    });
  } else if (oldFolderId) {
    await auditEntityFolderUnlinked({
      user,
      entityType,
      entityId: entity._id,
      entityName,
      oldFolderId,
      req,
    });
  }

  return getEntityById(entityId);
}

export const ENTITY_FOLDER_TYPES = {
  truck: TARGET_TYPES.TRUCK,
  trailer: TARGET_TYPES.TRAILER,
  driver: TARGET_TYPES.DRIVER,
};
