import validator from 'validator';
import { parse } from 'tldts';

export const EMAIL_INVALID_MESSAGE = 'Please enter a valid email address.';

function hasValidPublicTld(email) {
  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0) return false;

  const hostname = email.slice(atIndex + 1);
  const parsed = parse(hostname, { allowPrivateDomains: false });

  return Boolean(parsed.domain && parsed.publicSuffix && parsed.isIcann);
}

export function isValidEmail(email) {
  if (email === null || email === undefined || typeof email !== 'string') {
    return false;
  }

  if (!validator.isEmail(email, { allow_utf8_local_part: false })) {
    return false;
  }

  return hasValidPublicTld(email);
}
