function escapeRegexChar(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Digits-only form of a search query, with optional leading US country code removed. */
export function extractPhoneSearchDigits(search) {
  const digits = String(search || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }

  return digits;
}

/**
 * Matches phone strings regardless of spaces, dashes, parentheses, etc.
 * e.g. "704565" matches "(704) 565-8956".
 */
export function buildPhoneDigitSearchRegex(digits) {
  if (!digits || digits.length < 3) {
    return null;
  }

  const pattern = digits.split('').map(escapeRegexChar).join('\\D*');
  return new RegExp(pattern, 'i');
}

export function buildLeadSearchOrConditions(trimmedSearch, escapeRegex) {
  const regex = new RegExp(escapeRegex(trimmedSearch), 'i');
  const orConditions = [
    { firstName: regex },
    { lastName: regex },
    { email: regex },
    { stateCity: regex },
    { source: regex },
  ];

  const phoneDigits = extractPhoneSearchDigits(trimmedSearch);
  const phoneRegex = buildPhoneDigitSearchRegex(phoneDigits);

  orConditions.push({ phone: phoneRegex || regex });

  return orConditions;
}
