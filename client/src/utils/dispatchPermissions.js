export function hasDispatchModuleAccess(user) {
  return Boolean(
    user?.isDispatcher ||
    user?.isDispatchTeamLeader ||
    user?.isDispatchManager ||
    user?.role === 'SUPER_ADMIN'
  );
}

export function hasSafetyModuleAccess(user) {
  return Boolean(user?.isSafety || user?.isSafetyManager || user?.role === 'SUPER_ADMIN');
}

export function hasDispatchSafetyViewAccess(user) {
  return hasDispatchModuleAccess(user) || hasSafetyModuleAccess(user);
}

export function canEditSafetyEntities(user) {
  return Boolean(user?.isSafety || user?.isSafetyManager || user?.role === 'SUPER_ADMIN');
}

export function canDeleteSafetyEntities(user) {
  return Boolean(user?.isSafetyManager || user?.role === 'SUPER_ADMIN');
}

export function canEditAssignments(user) {
  return Boolean(
    user?.isSafety ||
    user?.isSafetyManager ||
    user?.isDispatchTeamLeader ||
    user?.isDispatchManager ||
    user?.role === 'SUPER_ADMIN'
  );
}

export function canLinkFolders(user) {
  return Boolean(user?.isSafety || user?.isSafetyManager || user?.role === 'SUPER_ADMIN');
}
