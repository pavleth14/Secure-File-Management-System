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
  return Boolean(
    user?.isRecruiter ||
    user?.isRecruitingManager ||
    user?.role === 'SUPER_ADMIN'
  );
}

export function hasRecruitingAllBoardsAccess(user) {
  return Boolean(
    user?.isRecruitingManager ||
    user?.role === 'SUPER_ADMIN' ||
    isRecruitingModuleUser(user)
  );
}

export function getUserId(user) {
  return user?.id?.toString?.() || user?._id?.toString?.() || null;
}

export function isOwnRecruiterBoard(user, boardUserId) {
  const userId = getUserId(user);
  const ownerId = boardUserId?.toString?.() || null;
  return Boolean(user?.isRecruiter && userId && ownerId && userId === ownerId);
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
  if (user?.isRecruitingManager || user?.role === 'SUPER_ADMIN') return true;
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
  if (user?.isRecruitingManager || user?.role === 'SUPER_ADMIN') return true;
  if (isRecruitingModuleUser(user) && !lead.archived) return true;

  const boardOwnerId = getLeadBoardOwnerId(lead);
  const userId = getUserId(user);

  if (
    user?.isRecruiter &&
    !user?.isRecruitingManager &&
    !lead.archived &&
    boardOwnerId &&
    userId &&
    boardOwnerId === userId
  ) {
    return true;
  }

  return false;
}

export function canViewLeadOnRecruiterBoard(user, lead) {
  if (user?.isRecruitingManager || user?.role === 'SUPER_ADMIN') return true;
  if (isRecruitingModuleUser(user) && !lead.archived) return true;

  const boardOwnerId = getLeadBoardOwnerId(lead);

  if (user?.isRecruiter && !lead.archived && boardOwnerId) {
    return true;
  }

  return false;
}
