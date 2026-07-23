export function getUserId(user) {
  return user?.id?.toString?.() || user?._id?.toString?.() || null;
}

export function isSuperAdmin(user) {
  return user?.role === 'SUPER_ADMIN';
}

export function hasDispatchModuleAccess(user) {
  return Boolean(
    user?.isDispatcher ||
    user?.isDispatchTeamLeader ||
    user?.isDispatchManager ||
    isSuperAdmin(user)
  );
}

export function hasSafetyModuleAccess(user) {
  return Boolean(user?.isSafety || user?.isSafetyManager || isSuperAdmin(user));
}

export function hasDispatchSafetyViewAccess(user) {
  return hasDispatchModuleAccess(user) || hasSafetyModuleAccess(user);
}

export function canEditSafetyEntities(user) {
  return Boolean(user?.isSafety || user?.isSafetyManager || isSuperAdmin(user));
}

export function canDeleteSafetyEntities(user) {
  return Boolean(user?.isSafetyManager || isSuperAdmin(user));
}

export function canManageDispatchBoardAssignment(user) {
  return Boolean(user?.isDispatchManager || isSuperAdmin(user));
}

export function canEditTruckAssignments(user) {
  return Boolean(
    user?.isSafety ||
    user?.isSafetyManager ||
    user?.isDispatchTeamLeader ||
    user?.isDispatchManager ||
    isSuperAdmin(user)
  );
}

export function canLinkEntityFolders(user) {
  return Boolean(user?.isSafety || user?.isSafetyManager || isSuperAdmin(user));
}

export function validateDispatchRoleCombo(flags) {
  if (flags.isDispatchManager && flags.isDispatchTeamLeader) {
    const err = new Error('A user cannot be both Dispatch Manager and Dispatch Team Leader');
    err.status = 400;
    throw err;
  }
}

export async function getTeamLeaderBoardId(user) {
  if (!user?.isDispatchTeamLeader) return null;
  const userId = getUserId(user);
  if (!userId) return null;

  const { DispatchBoard } = await import('../models/DispatchBoard.js');
  const board = await DispatchBoard.findOne({ teamLeaderId: userId }).select('_id');
  return board?._id?.toString() || null;
}

export function canEditAssignmentOnBoard(user, dispatcherBoardId) {
  if (isSuperAdmin(user) || user?.isDispatchManager || user?.isSafety || user?.isSafetyManager) {
    return true;
  }

  if (user?.isDispatchTeamLeader) {
    return true;
  }

  return false;
}
