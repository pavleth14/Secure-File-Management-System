import { auditLog, buildActorLabel } from './auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';

function truckLabel(truck) {
  return truck?.truckNumber ? `Truck ${truck.truckNumber}` : 'Truck';
}

function trailerLabel(trailer) {
  return trailer?.trailerNumber ? `Trailer ${trailer.trailerNumber}` : 'Trailer';
}

function driverLabel(driver) {
  return driver?.name || 'Driver';
}

function loadLabel(load) {
  return load?.loadNumber ? `Load #${load.loadNumber}` : 'Load';
}

export async function auditTruckCreated({ user, truck, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.TRUCK_CREATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.TRUCK,
    targetId: truck._id,
    targetName: truckLabel(truck),
    details: `${buildActorLabel(user)} created ${truckLabel(truck)}`,
    newValues: { truckNumber: truck.truckNumber, status: truck.status },
    req,
  });
}

export async function auditTruckUpdated({ user, truck, req, oldValues, newValues }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.TRUCK_UPDATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.TRUCK,
    targetId: truck._id,
    targetName: truckLabel(truck),
    details: `${buildActorLabel(user)} updated ${truckLabel(truck)}`,
    oldValues,
    newValues,
    req,
  });
}

export async function auditTruckDeleted({ user, truck, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.TRUCK_DELETE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.TRUCK,
    targetId: truck._id,
    targetName: truckLabel(truck),
    details: `${buildActorLabel(user)} deleted ${truckLabel(truck)}`,
    req,
  });
}

export async function auditTrailerCreated({ user, trailer, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.TRAILER_CREATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.TRAILER,
    targetId: trailer._id,
    targetName: trailerLabel(trailer),
    details: `${buildActorLabel(user)} created ${trailerLabel(trailer)}`,
    newValues: { trailerNumber: trailer.trailerNumber, status: trailer.status },
    req,
  });
}

export async function auditTrailerUpdated({ user, trailer, req, oldValues, newValues }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.TRAILER_UPDATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.TRAILER,
    targetId: trailer._id,
    targetName: trailerLabel(trailer),
    details: `${buildActorLabel(user)} updated ${trailerLabel(trailer)}`,
    oldValues,
    newValues,
    req,
  });
}

export async function auditTrailerDeleted({ user, trailer, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.TRAILER_DELETE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.TRAILER,
    targetId: trailer._id,
    targetName: trailerLabel(trailer),
    details: `${buildActorLabel(user)} deleted ${trailerLabel(trailer)}`,
    req,
  });
}

export async function auditDriverCreated({ user, driver, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.DRIVER_CREATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.DRIVER,
    targetId: driver._id,
    targetName: driverLabel(driver),
    details: `${buildActorLabel(user)} created driver ${driverLabel(driver)}`,
    newValues: { name: driver.name, status: driver.status },
    req,
  });
}

export async function auditDriverUpdated({ user, driver, req, oldValues, newValues }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.DRIVER_UPDATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.DRIVER,
    targetId: driver._id,
    targetName: driverLabel(driver),
    details: `${buildActorLabel(user)} updated driver ${driverLabel(driver)}`,
    oldValues,
    newValues,
    req,
  });
}

export async function auditDriverDeleted({ user, driver, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.DRIVER_DELETE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.DRIVER,
    targetId: driver._id,
    targetName: driverLabel(driver),
    details: `${buildActorLabel(user)} deleted driver ${driverLabel(driver)}`,
    req,
  });
}

export async function auditAssignmentUpdated({ user, assignment, req, changes }) {
  const truckNumber = assignment.truckId?.truckNumber || assignment.truckNumber;
  await auditLog({
    user,
    action: AUDIT_ACTIONS.ASSIGNMENT_UPDATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.ASSIGNMENT,
    targetId: assignment._id,
    targetName: truckNumber ? `Truck ${truckNumber} assignment` : 'Assignment',
    details: `${buildActorLabel(user)} updated assignment for truck ${truckNumber || 'unknown'}`,
    newValues: { changes },
    req,
  });
}

export async function auditEntityFolderLinked({
  user,
  entityType,
  entityId,
  entityName,
  folderId,
  folderPath,
  req,
}) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.ENTITY_FOLDER_LINK,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: entityType,
    targetId: entityId,
    targetName: entityName,
    details: `${buildActorLabel(user)} linked folder to ${entityName}`,
    newValues: { linkedFolderId: folderId, linkedFolderPath: folderPath },
    req,
  });
}

export async function auditEntityFolderUnlinked({ user, entityType, entityId, entityName, req, oldFolderId }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.ENTITY_FOLDER_UNLINK,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: entityType,
    targetId: entityId,
    targetName: entityName,
    details: `${buildActorLabel(user)} unlinked folder from ${entityName}`,
    oldValues: { linkedFolderId: oldFolderId },
    req,
  });
}

export async function auditLoadCreated({ user, load, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LOAD_CREATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.LOAD,
    targetId: load._id,
    targetName: loadLabel(load),
    details: `${buildActorLabel(user)} created ${loadLabel(load)}`,
    newValues: { loadNumber: load.loadNumber, truckId: load.truckId?.toString?.() || load.truckId },
    req,
  });
}

export async function auditLoadUpdated({ user, load, req, oldValues, newValues }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LOAD_UPDATE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.LOAD,
    targetId: load._id,
    targetName: loadLabel(load),
    details: `${buildActorLabel(user)} updated ${loadLabel(load)}`,
    oldValues,
    newValues,
    req,
  });
}

export async function auditLoadArchived({ user, load, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LOAD_ARCHIVE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.LOAD,
    targetId: load._id,
    targetName: loadLabel(load),
    details: `${buildActorLabel(user)} archived ${loadLabel(load)}`,
    req,
  });
}

export async function auditLoadMarkedActive({ user, load, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LOAD_MARK_ACTIVE,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.LOAD,
    targetId: load._id,
    targetName: loadLabel(load),
    details: `${buildActorLabel(user)} marked ${loadLabel(load)} as active`,
    req,
  });
}

export async function auditLoadMarkedOpen({ user, load, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LOAD_MARK_OPEN,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.LOAD,
    targetId: load._id,
    targetName: loadLabel(load),
    details: `${buildActorLabel(user)} marked ${loadLabel(load)} as open`,
    req,
  });
}

export async function auditLoadMarkedDelivered({ user, load, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LOAD_MARK_DELIVERED,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.LOAD,
    targetId: load._id,
    targetName: loadLabel(load),
    details: `${buildActorLabel(user)} marked ${loadLabel(load)} as delivered`,
    req,
  });
}

export async function auditLoadCommentAdded({ user, load, req, commentText }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LOAD_COMMENT_ADD,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.LOAD,
    targetId: load._id,
    targetName: loadLabel(load),
    details: `${buildActorLabel(user)} added a comment on ${loadLabel(load)}`,
    newValues: { comment: commentText },
    req,
  });
}

export async function auditLoadCommentEdited({ user, load, req, oldText, newText }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LOAD_COMMENT_EDIT,
    category: AUDIT_CATEGORIES.DISPATCH,
    targetType: TARGET_TYPES.LOAD,
    targetId: load._id,
    targetName: loadLabel(load),
    details: `${buildActorLabel(user)} edited a comment on ${loadLabel(load)}`,
    oldValues: { comment: oldText },
    newValues: { comment: newText },
    req,
  });
}
