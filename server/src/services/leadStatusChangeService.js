export function buildStatusChangeCommentText({
  oldStatus,
  newStatus,
  rejectionReason,
  hiredDate,
}) {
  const trimmedReason = rejectionReason ? String(rejectionReason).trim() : '';
  const trimmedHiredDate = hiredDate ? String(hiredDate).trim() : '';

  if (oldStatus && oldStatus !== newStatus) {
    let text = `Status changed from ${oldStatus} to ${newStatus}.`;
    if (trimmedReason) {
      text += ` Reason: ${trimmedReason}`;
    }
    if (trimmedHiredDate) {
      text += ` Hired date: ${trimmedHiredDate}`;
    }
    return text;
  }

  if (!oldStatus && newStatus) {
    let text = `Status set to ${newStatus}.`;
    if (trimmedReason) {
      text += ` Reason: ${trimmedReason}`;
    }
    if (trimmedHiredDate) {
      text += ` Hired date: ${trimmedHiredDate}`;
    }
    return text;
  }

  return null;
}

export function buildStatusChangeCommentSubdoc({
  userId,
  oldStatus,
  newStatus,
  rejectionReason,
  hiredDate,
  timestamp = new Date(),
}) {
  const text = buildStatusChangeCommentText({
    oldStatus,
    newStatus,
    rejectionReason,
    hiredDate,
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

export function appendStatusChangeComment(
  lead,
  { userId, oldStatus, newStatus, rejectionReason, hiredDate, timestamp = new Date() }
) {
  const comment = buildStatusChangeCommentSubdoc({
    userId,
    oldStatus,
    newStatus,
    rejectionReason,
    hiredDate,
    timestamp,
  });
  if (!comment) return false;

  if (!Array.isArray(lead.comments)) {
    lead.comments = [];
  }
  lead.comments.push(comment);
  return true;
}

export function prependStatusCommentsToLeadData(
  leadData,
  { userId, oldStatus, newStatus, rejectionReason, hiredDate, timestamp = new Date() }
) {
  const comment = buildStatusChangeCommentSubdoc({
    userId,
    oldStatus,
    newStatus,
    rejectionReason,
    hiredDate,
    timestamp,
  });
  if (!comment) return leadData;

  return {
    ...leadData,
    comments: [...(leadData.comments || []), comment],
  };
}
