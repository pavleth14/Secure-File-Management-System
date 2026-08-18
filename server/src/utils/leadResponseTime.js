const NEW_LEAD_STATUS = 'New Lead';

export function getLeadStartTime(lead) {
  if (!lead) return null;
  const value = lead.importedAt || lead.createdAt;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function computeResponseTimeMs(lead) {
  const start = getLeadStartTime(lead);
  const calledAt = lead.firstCalledAt
    ? lead.firstCalledAt instanceof Date
      ? lead.firstCalledAt
      : new Date(lead.firstCalledAt)
    : null;

  if (!start || !calledAt || Number.isNaN(calledAt.getTime())) return null;

  const durationMs = calledAt.getTime() - start.getTime();
  if (durationMs < 0) return null;

  return { durationMs, calledAt, startAt: start };
}

export function isWithinRange(date, dateFrom, dateTo) {
  if (!date) return false;
  const time = date.getTime();
  if (dateFrom && time < dateFrom.getTime()) return false;
  if (dateTo && time > dateTo.getTime()) return false;
  return true;
}

export { NEW_LEAD_STATUS };
