export function buildReassignmentCommentText({
  oldRecruiterName,
  newRecruiterName,
  sourceLabel,
}) {
  const newName = newRecruiterName ? String(newRecruiterName).trim() : '';
  if (!newName) return null;

  const oldName = oldRecruiterName ? String(oldRecruiterName).trim() : '';

  if (oldName && oldName !== newName) {
    return `Reassigned from ${oldName} to ${newName}.`;
  }

  if (sourceLabel) {
    return `Assigned from ${sourceLabel} to ${newName}.`;
  }

  if (!oldName) {
    return `Assigned to ${newName}.`;
  }

  return null;
}

export function buildReassignmentCommentSubdoc({
  userId,
  oldRecruiterName,
  newRecruiterName,
  sourceLabel,
  timestamp = new Date(),
}) {
  const text = buildReassignmentCommentText({
    oldRecruiterName,
    newRecruiterName,
    sourceLabel,
  });
  if (!text) return null;

  return {
    text,
    author: userId,
    isSystem: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function appendReassignmentComment(
  lead,
  { userId, oldRecruiterName, newRecruiterName, sourceLabel, timestamp = new Date() }
) {
  const comment = buildReassignmentCommentSubdoc({
    userId,
    oldRecruiterName,
    newRecruiterName,
    sourceLabel,
    timestamp,
  });
  if (!comment) return false;

  if (!Array.isArray(lead.comments)) {
    lead.comments = [];
  }
  lead.comments.push(comment);
  return true;
}

export function prependReassignmentCommentToLeadData(
  leadData,
  { userId, oldRecruiterName, newRecruiterName, sourceLabel, timestamp = new Date() }
) {
  const comment = buildReassignmentCommentSubdoc({
    userId,
    oldRecruiterName,
    newRecruiterName,
    sourceLabel,
    timestamp,
  });
  if (!comment) return leadData;

  return {
    ...leadData,
    comments: [...(leadData.comments || []), comment],
  };
}
