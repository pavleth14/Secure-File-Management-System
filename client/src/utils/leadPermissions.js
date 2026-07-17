import { LEAD_PERSONAL_INFO_EDIT_WINDOW_MS, LEAD_COMMENT_EDIT_WINDOW_MS } from '../constants/recruitingConstants';

export function isWithinPersonalInfoEditWindow(lead) {
  if (!lead?.createdAt) return false;
  const createdAt = new Date(lead.createdAt).getTime();
  return Date.now() - createdAt <= LEAD_PERSONAL_INFO_EDIT_WINDOW_MS;
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

export function canEditPersonalInfo(lead, isRecruitingManager) {
  if (isRecruitingManager) return true;
  return isWithinPersonalInfoEditWindow(lead);
}

export function canEditStatus(isRecruitingManager, isRecruiter) {
  return Boolean(isRecruitingManager || isRecruiter);
}

export function canEditDriverType(isRecruitingManager, isRecruiter) {
  return Boolean(isRecruitingManager || isRecruiter);
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
