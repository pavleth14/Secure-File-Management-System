import { isImportPlaceholderEmail } from './importPlaceholderEmail.js';
import { buildPhoneDigitSearchRegex } from './leadPhoneSearch.js';
import { normalizeUsPhoneDigits, phonesMatch } from './usPhone.js';

export function normalizeLeadContactEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

export function isMissingLeadEmail(email) {
  const normalized = normalizeLeadContactEmail(email);
  return !normalized || isImportPlaceholderEmail(normalized);
}

export function normalizeLeadContactPhoneDigits(phone) {
  return normalizeUsPhoneDigits(phone);
}

export function buildLeadDuplicateOrConditions({ email, phone, emailMissing = false }) {
  const normalizedEmail = normalizeLeadContactEmail(email);
  const treatEmailAsMissing = emailMissing || isMissingLeadEmail(normalizedEmail);
  const phoneDigits = normalizeLeadContactPhoneDigits(phone);
  const conditions = [];

  if (!treatEmailAsMissing) {
    conditions.push({ email: normalizedEmail });
  }

  if (phoneDigits) {
    conditions.push({ phoneDigits });
    const phoneRegex = buildPhoneDigitSearchRegex(phoneDigits);
    if (phoneRegex) {
      conditions.push({
        $and: [
          { $or: [{ phoneDigits: { $exists: false } }, { phoneDigits: '' }] },
          { phone: phoneRegex },
        ],
      });
    }
  }

  return conditions;
}

export function buildLeadDuplicateFilter({
  email,
  phone,
  emailMissing = false,
  excludeLeadId = null,
}) {
  const orConditions = buildLeadDuplicateOrConditions({ email, phone, emailMissing });
  if (!orConditions.length) {
    return null;
  }

  const filter = { $or: orConditions };
  if (excludeLeadId) {
    filter._id = { $ne: excludeLeadId };
  }
  return filter;
}

export function leadContactsMatch(
  duplicate,
  { email, phone, emailMissing = false }
) {
  if (!duplicate) return false;

  const normalizedEmail = normalizeLeadContactEmail(email);
  const treatEmailAsMissing = emailMissing || isMissingLeadEmail(normalizedEmail);
  const phoneDigits = normalizeLeadContactPhoneDigits(phone);

  if (!treatEmailAsMissing && duplicate.email === normalizedEmail) {
    return true;
  }

  if (!phoneDigits) {
    return false;
  }

  if (duplicate.phoneDigits && duplicate.phoneDigits === phoneDigits) {
    return true;
  }

  return phonesMatch(duplicate.phone, phone);
}

export function getLeadDuplicateContactReason(
  duplicate,
  { email, phone, emailMissing = false }
) {
  if (!leadContactsMatch(duplicate, { email, phone, emailMissing })) {
    return null;
  }

  const normalizedEmail = normalizeLeadContactEmail(email);
  const treatEmailAsMissing = emailMissing || isMissingLeadEmail(normalizedEmail);

  if (!treatEmailAsMissing && duplicate.email === normalizedEmail) {
    return 'email';
  }

  return 'phone';
}

/** @deprecated Use buildLeadDuplicateFilter — kept for import modules. */
export function buildImportDuplicateFilter(
  normalizedEmail,
  normalizedPhone,
  emailMissing = false
) {
  return buildLeadDuplicateFilter({
    email: normalizedEmail,
    phone: normalizedPhone,
    emailMissing,
  });
}

export function buildOldLeadDuplicateFilter(
  normalizedEmail,
  normalizedPhone,
  emailMissing = false
) {
  const normalizedEmailValue = normalizeLeadContactEmail(normalizedEmail);
  const treatEmailAsMissing =
    emailMissing || isMissingLeadEmail(normalizedEmailValue);
  const phoneDigits = normalizeLeadContactPhoneDigits(normalizedPhone);
  const conditions = [];

  if (!treatEmailAsMissing && normalizedEmailValue) {
    conditions.push({ email: normalizedEmailValue });
  }

  if (phoneDigits) {
    const phoneRegex = buildPhoneDigitSearchRegex(phoneDigits);
    if (phoneRegex) {
      conditions.push({ phone: phoneRegex });
    }
  }

  return conditions.length ? { $or: conditions } : null;
}
