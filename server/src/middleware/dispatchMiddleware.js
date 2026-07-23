import {
  hasDispatchSafetyViewAccess,
  canEditSafetyEntities,
  canDeleteSafetyEntities,
  canManageDispatchBoardAssignment,
  canEditTruckAssignments,
  canLinkEntityFolders,
  hasDispatchModuleAccess,
  canCreateOrEditLoads,
  canArchiveLoads,
  canViewArchivedLoads,
  canCommentOnLoads,
} from '../utils/dispatchPermissions.js';

export function requireDispatchSafetyView(req, res, next) {
  if (!hasDispatchSafetyViewAccess(req.user)) {
    return res.status(403).json({ message: 'Dispatch or Safety access required' });
  }
  next();
}

export function requireSafetyEdit(req, res, next) {
  if (!canEditSafetyEntities(req.user)) {
    return res.status(403).json({ message: 'Safety edit access required' });
  }
  next();
}

export function requireSafetyDelete(req, res, next) {
  if (!canDeleteSafetyEntities(req.user)) {
    return res.status(403).json({ message: 'Safety manager access required' });
  }
  next();
}

export function requireAssignmentEdit(req, res, next) {
  if (!canEditTruckAssignments(req.user)) {
    return res.status(403).json({ message: 'Assignment edit access required' });
  }
  next();
}

export function requireDispatchBoardManagement(req, res, next) {
  if (!canManageDispatchBoardAssignment(req.user)) {
    return res.status(403).json({ message: 'Dispatch manager access required' });
  }
  next();
}

export function requireFolderLinkAccess(req, res, next) {
  if (!canLinkEntityFolders(req.user)) {
    return res.status(403).json({ message: 'Safety access required to link folders' });
  }
  next();
}

export function requireDispatchModuleAccess(req, res, next) {
  if (!hasDispatchModuleAccess(req.user)) {
    return res.status(403).json({ message: 'Dispatch access required' });
  }
  next();
}

export function requireLoadEditAccess(req, res, next) {
  if (!canCreateOrEditLoads(req.user)) {
    return res.status(403).json({ message: 'Dispatch access required to manage loads' });
  }
  next();
}

export function requireLoadArchiveAccess(req, res, next) {
  if (!canArchiveLoads(req.user)) {
    return res.status(403).json({ message: 'Dispatch manager access required' });
  }
  next();
}

export function requireArchivedLoadsView(req, res, next) {
  if (!canViewArchivedLoads(req.user)) {
    return res.status(403).json({ message: 'Access denied to archived loads' });
  }
  next();
}

export function requireLoadCommentAccess(req, res, next) {
  if (!canCommentOnLoads(req.user)) {
    return res.status(403).json({ message: 'Access denied to load comments' });
  }
  next();
}
