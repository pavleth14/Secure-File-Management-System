/**
 * Normalize US phone numbers for matching (handles '+1222...', "'+1222...", spaces, dashes).
 * Returns 10-digit NANP number or empty string if invalid.
 */
export function normalizeUsPhoneDigits(phone) {
  if (phone == null || phone === '') return '';

  let raw = String(phone).trim();
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return '';
}

/** E.164 format for RingCentral API (+1XXXXXXXXXX). */
export function toE164UsPhone(phone) {
  const digits = normalizeUsPhoneDigits(phone);
  if (!digits || digits.length !== 10) return '';
  return `+1${digits}`;
}

export function phonesMatch(phoneA, phoneB) {
  const a = normalizeUsPhoneDigits(phoneA);
  const b = normalizeUsPhoneDigits(phoneB);
  return Boolean(a && b && a === b);
}
