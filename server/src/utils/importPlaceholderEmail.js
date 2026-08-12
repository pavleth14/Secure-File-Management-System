import { randomUUID } from 'crypto';

export const IMPORT_PLACEHOLDER_EMAIL_DOMAIN = 'import.local';
export const IMPORT_PLACEHOLDER_EMAIL_PATTERN = /^no-email-.+@import\.local$/i;

export function isImportPlaceholderEmail(email) {
  return IMPORT_PLACEHOLDER_EMAIL_PATTERN.test(String(email || '').trim());
}

export function generateImportPlaceholderEmail() {
  return `no-email-${randomUUID()}@${IMPORT_PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function formatImportEmailForDisplay(
  email,
  { emptyLabel = '—', placeholderLabel = 'N/A' } = {}
) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return emptyLabel;
  if (isImportPlaceholderEmail(trimmed)) return placeholderLabel;
  return trimmed;
}

export function normalizeImportEmailForEdit(email) {
  if (isImportPlaceholderEmail(email)) return '';
  return String(email || '').trim();
}
