import validator from 'validator';
import { parse } from 'tldts';

export const COMPANY_EMAIL_DOMAIN = 'twobrothersfreight.com';
export const EMAIL_INVALID_MESSAGE = 'Please enter a valid email address.';

function hasValidEmailSyntax(email) {
  if (email === null || email === undefined || typeof email !== 'string') {
    return false;
  }

  if (!validator.isEmail(email, { allow_utf8_local_part: false })) {
    return false;
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0) return false;

  const hostname = email.slice(atIndex + 1);
  const parsed = parse(hostname, { allowPrivateDomains: false });

  return Boolean(parsed.domain && parsed.publicSuffix && parsed.isIcann);
}

function getEmailDomain(email) {
  const atIndex = email.lastIndexOf('@');
  return atIndex > 0 ? email.slice(atIndex + 1).toLowerCase() : '';
}

function isCompanyEmailDomain(email) {
  return getEmailDomain(email) === COMPANY_EMAIL_DOMAIN;
}

function isSuperAdminEmail(email, superAdminEmail) {
  if (!superAdminEmail) return false;
  return email.toLowerCase() === superAdminEmail.toLowerCase();
}

/** Registration and account creation — company domain only. */
export function isValidEmail(email) {
  if (!hasValidEmailSyntax(email)) {
    return false;
  }

  return isCompanyEmailDomain(email);
}

/** Login — company domain, or the configured superadmin email. */
export function isValidLoginEmail(email, superAdminEmail = null) {
  if (!hasValidEmailSyntax(email)) {
    return false;
  }

  if (isSuperAdminEmail(email, superAdminEmail)) {
    return true;
  }

  return isCompanyEmailDomain(email);
}

export function getSuperAdminEmailFromEnv() {
  return import.meta.env.VITE_SUPER_ADMIN_EMAIL || null;
}
