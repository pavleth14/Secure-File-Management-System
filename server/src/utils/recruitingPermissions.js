/**
 * Normal USER role recruiting access (not isRecruiter / isRecruitingManager).
 * Grants board visibility and lead editing within recruiting module rules only.
 */
export function isRecruitingModuleUser(user) {
  return (
    user?.role === 'USER' &&
    !user?.isRecruiter &&
    !user?.isRecruitingManager
  );
}

export function hasRecruitingModuleAccess(user) {
  return Boolean(user?.isRecruiter || user?.isRecruitingManager || isRecruitingModuleUser(user));
}

export function hasRecruitingAllBoardsAccess(user) {
  return Boolean(user?.isRecruitingManager || isRecruitingModuleUser(user));
}

export function isOwnRecruiterBoard(user, boardUserId) {
  return Boolean(
    user?.isRecruiter && user._id.toString() === boardUserId.toString()
  );
}

export function isRecruiterReadOnlyBoard(user, boardUserId) {
  return Boolean(
    user?.isRecruiter &&
    !user?.isRecruitingManager &&
    boardUserId &&
    !isOwnRecruiterBoard(user, boardUserId)
  );
}

export function canMutateLeadsOnBoard(user, boardUserId) {
  if (user?.isRecruitingManager) return true;
  if (isRecruitingModuleUser(user)) return true;
  if (isOwnRecruiterBoard(user, boardUserId)) return true;
  return false;
}

export function getLeadBoardOwnerId(lead) {
  return (
    lead?.assignedRecruiter?._id?.toString?.() ||
    lead?.assignedRecruiter?.toString?.() ||
    null
  );
}

export function canMutateLead(user, lead) {
  if (user?.isRecruitingManager) return true;
  if (isRecruitingModuleUser(user) && !lead.archived) return true;

  const boardOwnerId = getLeadBoardOwnerId(lead);

  if (
    user?.isRecruiter &&
    !user?.isRecruitingManager &&
    !lead.archived &&
    boardOwnerId === user._id.toString()
  ) {
    return true;
  }

  return false;
}

export function canViewLeadOnRecruiterBoard(user, lead) {
  if (user?.isRecruitingManager) return true;
  if (isRecruitingModuleUser(user) && !lead.archived) return true;

  const boardOwnerId = getLeadBoardOwnerId(lead);

  if (user?.isRecruiter && !lead.archived && boardOwnerId) {
    return true;
  }

  return false;
}
