export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS_HINT =
  'At least 8 characters, with uppercase, lowercase, a number, and a special character (*&^%$#!).';

export const PASSWORD_INVALID_MESSAGE = `Password does not meet requirements. ${PASSWORD_REQUIREMENTS_HINT}`;

const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /\d/;
const HAS_SPECIAL = /[*&^%$#!@\-_+=]/;

export function validatePassword(password) {
  const value = String(password || '');
  if (value.length < PASSWORD_MIN_LENGTH) return false;
  if (!HAS_UPPERCASE.test(value)) return false;
  if (!HAS_LOWERCASE.test(value)) return false;
  if (!HAS_NUMBER.test(value)) return false;
  if (!HAS_SPECIAL.test(value)) return false;
  return true;
}

export function assertValidPassword(password) {
  if (!validatePassword(password)) {
    const err = new Error(PASSWORD_INVALID_MESSAGE);
    err.status = 400;
    throw err;
  }
}
