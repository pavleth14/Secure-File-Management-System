export function getLatestRingCentralEvent(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  return [...events].sort(
    (a, b) => new Date(b.occurredAt || b.createdAt) - new Date(a.occurredAt || a.createdAt)
  )[0];
}

export function sortRingCentralEventsNewestFirst(events) {
  if (!Array.isArray(events)) return [];
  return [...events].sort(
    (a, b) => new Date(b.occurredAt || b.createdAt) - new Date(a.occurredAt || a.createdAt)
  );
}
