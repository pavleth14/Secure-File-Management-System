const NEW_LEAD_STATUS = 'New Lead';
const ATTEMPTING_STATUS = 'Attempting';

const STATUS_CHANGE_PATTERN = /^Status changed from (.+?) to (.+?)\./;

export function getLeadStartTime(lead) {
  if (!lead) return null;
  const value = lead.importedAt || lead.createdAt;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function findFirstNewLeadToAttemptingAt(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return null;
  }

  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const comment of sorted) {
    if (!comment?.isSystem) continue;

    const text = String(comment.text || '').trim();
    const match = text.match(STATUS_CHANGE_PATTERN);
    if (!match) continue;

    const fromStatus = match[1].trim();
    const toStatus = match[2].trim();
    if (fromStatus === NEW_LEAD_STATUS && toStatus === ATTEMPTING_STATUS) {
      const at = new Date(comment.createdAt);
      return Number.isNaN(at.getTime()) ? null : at;
    }
  }

  return null;
}

export function isWithinRange(date, dateFrom, dateTo) {
  if (!date) return false;
  const time = date.getTime();
  if (dateFrom && time < dateFrom.getTime()) return false;
  if (dateTo && time > dateTo.getTime()) return false;
  return true;
}

export function computeResponseTimeMs(lead) {
  const start = getLeadStartTime(lead);
  const attemptingAt = findFirstNewLeadToAttemptingAt(lead.comments);
  if (!start || !attemptingAt) return null;

  const durationMs = attemptingAt.getTime() - start.getTime();
  if (durationMs < 0) return null;

  return { durationMs, attemptingAt, startAt: start };
}
