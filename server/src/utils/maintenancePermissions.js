export function isSuperAdmin(user) {
  return user?.role === 'SUPER_ADMIN';
}

export function hasMaintenanceModuleAccess(user) {
  return Boolean(
    user?.isMaintenance ||
      user?.isMaintenanceManager ||
      user?.isMaintenanceViewer ||
      isSuperAdmin(user)
  );
}

export function canViewMaintenanceBoard(user) {
  return hasMaintenanceModuleAccess(user);
}

export function isMaintenanceViewOnly(user) {
  if (isSuperAdmin(user) || user?.isMaintenanceManager || user?.isMaintenance) {
    return false;
  }
  return Boolean(user?.isMaintenanceViewer);
}

export function canEditMaintenanceCases(user) {
  return hasMaintenanceModuleAccess(user);
}

export function canDeleteMaintenanceCases(user) {
  return Boolean(isSuperAdmin(user) || user?.isMaintenanceManager);
}

export function canCommentOnMaintenanceCase(user) {
  return canEditMaintenanceCases(user);
}

export function canManageMaintenanceTags(user) {
  return canEditMaintenanceCases(user);
}

/** Maint. Mgr and Super Admin may assign cases to any eligible maintenance assignee. */
export function canAssignMaintenanceCaseToAnyone(user) {
  return Boolean(isSuperAdmin(user) || user?.isMaintenanceManager);
}

export function canCreateMaintenanceCases(user) {
  return hasMaintenanceModuleAccess(user);
}

export function canUploadMaintenanceCaseAttachment(user, maintenanceCase) {
  if (canEditMaintenanceCases(user)) return true;
  if (!hasMaintenanceModuleAccess(user) || !maintenanceCase) return false;

  const userId = user._id?.toString?.() || String(user._id);
  const assigneeId =
    maintenanceCase.assigneeId?._id?.toString?.() ||
    maintenanceCase.assigneeId?.toString?.() ||
    maintenanceCase.assigneeId ||
    null;
  const createdById =
    maintenanceCase.createdBy?._id?.toString?.() ||
    maintenanceCase.createdBy?.toString?.() ||
    maintenanceCase.createdBy ||
    null;

  return userId === assigneeId || userId === createdById;
}
