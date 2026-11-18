export function normalizeCaseTypes(raw) {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw.map((entry) => String(entry || '').trim()).filter(Boolean)
      ),
    ];
  }
  const single = String(raw || '').trim();
  return single ? [single] : [];
}

export function parseCaseTypesFromPayload(payload) {
  if (payload?.caseTypes !== undefined) {
    return normalizeCaseTypes(payload.caseTypes);
  }
  if (payload?.caseType !== undefined) {
    return normalizeCaseTypes(payload.caseType);
  }
  return undefined;
}