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
