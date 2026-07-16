export function formatUserResponse(user) {
  const obj = user.toObject ? user.toObject() : user;
  return {
    id: obj._id,
    name: obj.name,
    email: obj.email,
    role: obj.role,
    groupId: obj.groupId?._id || obj.groupId || null,
    groupName: obj.groupId?.name || null,
    group: obj.groupId?.name ? { id: obj.groupId._id, name: obj.groupId.name } : null,
    isRecruiter: Boolean(obj.isRecruiter),
    isRecruitingManager: Boolean(obj.isRecruitingManager),
    createdAt: obj.createdAt,
  };
}

export function recruiterBoardLabel(name) {
  return `${name} Board`;
}
