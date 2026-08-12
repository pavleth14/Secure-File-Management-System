const IMPORT_PLACEHOLDER_EMAIL_PATTERN = /^no-email-.+@import\.local$/i;

export function isImportPlaceholderEmail(email) {
  return IMPORT_PLACEHOLDER_EMAIL_PATTERN.test(String(email || '').trim());
}

export function formatLeadDisplayEmail(email, emptyLabel = '—') {
  const trimmed = String(email || '').trim();
  if (!trimmed) return emptyLabel;
  if (isImportPlaceholderEmail(trimmed)) return 'N/A';
  return trimmed;
}

export function normalizeLeadEmailForEdit(email) {
  if (isImportPlaceholderEmail(email)) return '';
  return String(email || '').trim();
}
