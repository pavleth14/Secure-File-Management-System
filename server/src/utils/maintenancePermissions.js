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
  if (isSuperAdmin(user) || user?.isMaintenanceManager) return true;
  if (user?.isMaintenance && !user?.isMaintenanceViewer) return true;
  return false;
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
