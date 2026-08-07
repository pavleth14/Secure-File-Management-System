function stripPhoneInput(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^p:/i, '')
    .trim();
}

/**
 * Returns 10-digit US national number, or null if not a US number.
 */
export function parseUsPhoneDigits(value) {
  const stripped = stripPhoneInput(value);
  if (!stripped) return null;

  const digits = stripped.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }

  if (digits.length === 10) {
    return digits;
  }

  return null;
}

export function formatLeadPhoneDisplay(value) {
  const raw = stripPhoneInput(value);
  if (!raw) return '—';

  const nationalDigits = parseUsPhoneDigits(raw);
  if (!nationalDigits) {
    return raw;
  }

  const area = nationalDigits.slice(0, 3);
  const prefix = nationalDigits.slice(3, 6);
  const line = nationalDigits.slice(6);
  return `(${area}) ${prefix}-${line}`;
}

export function getLeadPhoneTelHref(value) {
  const nationalDigits = parseUsPhoneDigits(value);
  if (!nationalDigits) return null;
  return `tel:+1${nationalDigits}`;
}

export function isUsPhoneNumber(value) {
  return parseUsPhoneDigits(value) !== null;
}
