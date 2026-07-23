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

export function canAccessLoadsModule(user) {
  return hasDispatchModuleAccess(user);
}

export function canCreateOrEditLoads(user) {
  return Boolean(
    user?.isDispatcher ||
    user?.isDispatchTeamLeader ||
    user?.isDispatchManager ||
    isSuperAdmin(user)
  );
}

export function canArchiveLoads(user) {
  return Boolean(user?.isDispatchManager || isSuperAdmin(user));
}

export function canViewArchivedLoads(user) {
  return Boolean(
    user?.isDispatchTeamLeader ||
    user?.isDispatchManager ||
    isSuperAdmin(user)
  );
}

export function canCommentOnLoads(user) {
  return hasDispatchModuleAccess(user) || hasSafetyModuleAccess(user);
}

export async function getLoadTruckAssignment(truckId) {
  const { TruckAssignment } = await import('../models/TruckAssignment.js');
  return TruckAssignment.findOne({ truckId })
    .populate('dispatcherId', 'name dispatchBoardId')
    .populate('driverId', 'name driverType')
    .populate('coDriverId', 'name');
}

export async function loadBelongsToDispatcher(load, dispatcherUserId) {
  if (!load?.truckId || !dispatcherUserId) return false;
  const truckId = load.truckId._id?.toString() || load.truckId.toString();
  const assignment = await getLoadTruckAssignment(truckId);
  return assignment?.dispatcherId?._id?.toString() === dispatcherUserId.toString();
}

export async function loadBelongsToTeamLeaderBoard(load, teamLeaderUserId) {
  if (!load?.truckId || !teamLeaderUserId) return false;
  const { DispatchBoard } = await import('../models/DispatchBoard.js');
  const board = await DispatchBoard.findOne({ teamLeaderId: teamLeaderUserId }).select('_id');
  if (!board) return false;

  const truckId = load.truckId._id?.toString() || load.truckId.toString();
  const assignment = await getLoadTruckAssignment(truckId);
  const boardId = assignment?.dispatcherId?.dispatchBoardId?._id || assignment?.dispatcherId?.dispatchBoardId;
  return boardId?.toString() === board._id.toString();
}

export async function canMarkLoadActiveOrDone(user, load) {
  if (isSuperAdmin(user) || user?.isDispatchManager) return true;

  const userId = getUserId(user);
  if (!userId || load.archived || load.status === 'delivered') return false;

  if (user?.isDispatchTeamLeader) {
    return loadBelongsToTeamLeaderBoard(load, userId);
  }

  if (user?.isDispatcher) {
    return loadBelongsToDispatcher(load, userId);
  }

  return false;
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
