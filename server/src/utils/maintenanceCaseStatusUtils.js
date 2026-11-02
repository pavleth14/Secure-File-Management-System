const STANDARD_CASE_STATUS_CANONICAL = Object.freeze({
  open: 'Open',
  pending: 'Pending',
  closed: 'Closed',
});

export function canonicalCaseStatusName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  const key = trimmed.toLowerCase();
  return STANDARD_CASE_STATUS_CANONICAL[key] || trimmed;
}

/** Stored tag/case name: same word = case-insensitive only (Close ≠ Closed). Preserves user casing. */
export function resolveCaseStatusStorageName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return trimmed;
}

export function caseStatusNamesEquivalent(a, b) {
  return (
    String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  );
}

function pickPreferredCaseStatusTag(tags) {
  if (!tags.length) return null;
  const ranked = [...tags].sort((a, b) => {
    const canonA = canonicalCaseStatusName(a.name);
    const canonB = canonicalCaseStatusName(b.name);
    const aStandard = canonA === a.name ? 0 : 1;
    const bStandard = canonB === b.name ? 0 : 1;
    if (aStandard !== bStandard) return aStandard - bStandard;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
  const canonical = canonicalCaseStatusName(ranked[0].name);
  return { keeper: ranked[0], canonicalName: canonical };
}

export function dedupeCaseStatusTagRecords(records) {
  const byLower = new Map();
  for (const tag of records) {
    const key = tag.name.toLowerCase();
    const existing = byLower.get(key);
    if (!existing) {
      byLower.set(key, tag);
      continue;
    }
    const pick = pickPreferredCaseStatusTag([existing, tag]);
    byLower.set(key, pick.keeper);
  }
  return [...byLower.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export { pickPreferredCaseStatusTag };
