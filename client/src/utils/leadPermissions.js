import { LEAD_PERSONAL_INFO_EDIT_WINDOW_MS, LEAD_COMMENT_EDIT_WINDOW_MS } from '../constants/recruitingConstants';

export function isWithinPersonalInfoEditWindow(lead) {
  const referenceDate = lead?.importedAt || lead?.createdAt;
  if (!referenceDate) return false;

  const referenceTime = new Date(referenceDate).getTime();
  const now = Date.now();
  const timeDifferenceMs = now - referenceTime;
  const withinWindow = timeDifferenceMs <= LEAD_PERSONAL_INFO_EDIT_WINDOW_MS;

  console.log('[PERSONAL-INFO-EDIT-WINDOW]', {
    leadId: lead?.id || lead?._id,
    createdAt: lead?.createdAt,
    importedAt: lead?.importedAt,
    referenceUsed: lead?.importedAt ? 'importedAt' : 'createdAt',
    currentTime: new Date(now).toISOString(),
    timeDifferenceMs,
    editWindowMs: LEAD_PERSONAL_INFO_EDIT_WINDOW_MS,
    withinWindow,
  });

  return withinWindow;
}

export function isWithinCommentEditWindow(comment) {
  if (!comment?.createdAt) return false;
  const createdAt = new Date(comment.createdAt).getTime();
  return Date.now() - createdAt <= LEAD_COMMENT_EDIT_WINDOW_MS;
}

export function canEditComment(comment, currentUserId) {
  if (!comment || !currentUserId) return false;
  const authorId = comment.authorId?.toString?.() || comment.authorId;
  if (authorId && authorId !== currentUserId.toString()) return false;
  return isWithinCommentEditWindow(comment);
}

export function canEditPersonalInfo(
  lead,
  { isRecruitingManager = false, isRecruiter = false, isOwnBoard = false, readOnly = false } = {}
) {
  const editWindow = isWithinPersonalInfoEditWindow(lead);

  console.log('[CAN EDIT PERSONAL INFO CHECK]', {
    leadId: lead?.id || lead?._id,
    leadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`,
    createdAt: lead?.createdAt,
    importedAt: lead?.importedAt,
    isRecruitingManager,
    isRecruiter,
    isOwnBoard,
    readOnly,
    editWindow,
  });

  if (readOnly) {
    console.log('[CAN EDIT PERSONAL INFO RESULT]', false, 'Reason: readOnly');
    return false;
  }

  if (isRecruitingManager) {
    console.log('[CAN EDIT PERSONAL INFO RESULT]', true, 'Reason: recruiting manager');
    return true;
  }

  if (!isRecruiter || !isOwnBoard) {
    console.log('[CAN EDIT PERSONAL INFO RESULT]', false, 'Reason: not own recruiter board');
    return false;
  }

  console.log('[CAN EDIT PERSONAL INFO RESULT]', editWindow, 'Reason: 24h window check');

  return editWindow;
}

export function canEditStatus(
  isRecruitingManager,
  isRecruiter,
  { readOnly = false, isOwnBoard = false } = {}
) {
  if (readOnly) return false;
  if (isRecruitingManager) return true;
  return Boolean(isRecruiter && isOwnBoard);
}

export function canEditDriverType(
  isRecruitingManager,
  isRecruiter,
  { readOnly = false, isOwnBoard = false } = {}
) {
  if (readOnly) return false;
  if (isRecruitingManager) return true;
  return Boolean(isRecruiter && isOwnBoard);
}

export function isRecruiterBoardReadOnly({ isRecruiter, isRecruitingManager, isOwnBoard }) {
  return Boolean(isRecruiter && !isRecruitingManager && !isOwnBoard);
}

export function getLatestComment(comments) {
  if (!comments?.length) return null;
  return [...comments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

export function sortCommentsNewestFirst(comments) {
  return [...(comments || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getLeadDateRange(preset, customStart, customEnd) {
  if (preset === 'all') return { dateFrom: '', dateTo: '' };
  if (preset === 'custom') return { dateFrom: customStart, dateTo: customEnd };

  const now = new Date();
  const dateTo = now.toISOString().split('T')[0];
  let dateFrom;

  if (preset === 'today') {
    dateFrom = dateTo;
  } else {
    const days = parseInt(preset, 10);
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    dateFrom = start.toISOString().split('T')[0];
  }

  return { dateFrom, dateTo };
}
