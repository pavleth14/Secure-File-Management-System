import validator from 'validator';

export const LOGIN_EMAIL_INVALID_MESSAGE = 'Please enter a valid email address.';

function hasOnlyRepeatedDomainLabels(email) {
  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0) return false;

  const domain = email.slice(atIndex + 1);
  const labels = domain.split('.').filter(Boolean);
  if (labels.length < 2) return false;

  const first = labels[0].toLowerCase();
  return labels.every((label) => label.toLowerCase() === first);
}

export function isValidLoginEmail(email) {
  if (email === null || email === undefined || typeof email !== 'string') {
    return false;
  }

  if (!validator.isEmail(email, { allow_utf8_local_part: false })) {
    return false;
  }

  return !hasOnlyRepeatedDomainLabels(email);
}
