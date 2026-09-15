import { DuplicateLead } from '../models/DuplicateLead.js';
import {
  getLeadDuplicateContactReason,
  isMissingLeadEmail,
  normalizeLeadContactEmail,
  normalizeLeadContactPhoneDigits,
} from '../utils/leadDuplicateContact.js';
import { normalizeUsPhoneDigits } from '../utils/usPhone.js';

export function buildDuplicateContactKey({ email, phone, emailMissing = false }) {
  const phoneDigits = normalizeLeadContactPhoneDigits(phone);
  if (phoneDigits) {
    return `phone:${phoneDigits}`;
  }

  const normalizedEmail = normalizeLeadContactEmail(email);
  if (!emailMissing && !isMissingLeadEmail(normalizedEmail)) {
    return `email:${normalizedEmail}`;
  }

  return `unknown:${normalizedEmail || phone || 'contact'}`;
}

/** Total applications = original board lead + rejected duplicate attempts. */
export function getTotalTimesApplied(rejectedAttemptCount) {
  return Math.max((rejectedAttemptCount || 0) + 1, 1);
}

function formatDuplicateLeadRow(doc, rejectedAttemptCount) {
  const matchedLead = doc.matchedLeadId;
  return {
    id: doc._id,
    firstName: doc.firstName,
    lastName: doc.lastName,
    phone: doc.phone,
    email: doc.email,
    stateCity: doc.stateCity || '',
    driverType: doc.driverType || '',
    source: doc.source || '',
    date: doc.date || '',
    duplicateReason: doc.duplicateReason,
    contactKey: doc.contactKey,
    rejectedAttemptCount,
    submissionCount: getTotalTimesApplied(rejectedAttemptCount),
    duplicateAttemptCount: rejectedAttemptCount,
    ingestionSource: doc.ingestionSource,
    receivedAt: doc.receivedAt,
    matchedLead: matchedLead
      ? {
          id: matchedLead._id || matchedLead,
          firstName: matchedLead.firstName || null,
          lastName: matchedLead.lastName || null,
          status: matchedLead.status || null,
        }
      : null,
  };
}

export async function recordDuplicateLeadAttempt(attempt, matchedLead) {
  if (!matchedLead?._id) {
    return null;
  }

  const email = normalizeLeadContactEmail(attempt.email);
  const phone = String(attempt.phone || '').trim();
  const emailMissing = attempt.emailMissing ?? isMissingLeadEmail(email);
  const duplicateReason =
    getLeadDuplicateContactReason(matchedLead, {
      email,
      phone,
      emailMissing,
    }) || attempt.duplicateReason || 'phone';

  const contactKey = buildDuplicateContactKey({ email, phone, emailMissing });

  return DuplicateLead.create({
    firstName: String(attempt.firstName || '').trim() || '—',
    lastName: String(attempt.lastName || '').trim() || '—',
    phone,
    phoneDigits: normalizeUsPhoneDigits(phone),
    email: email || '',
    stateCity: String(attempt.stateCity || '').trim(),
    driverType: attempt.driverType || 'Solo',
    source: String(attempt.source || '').trim(),
    date: String(attempt.date || '').trim(),
    duplicateReason,
    contactKey,
    matchedLeadId: matchedLead._id,
    ingestionSource: attempt.ingestionSource,
    ingestionMeta: attempt.ingestionMeta || null,
    receivedAt: attempt.receivedAt ? new Date(attempt.receivedAt) : new Date(),
  });
}

async function getRejectedAttemptCountMap() {
  const grouped = await DuplicateLead.aggregate([
    { $group: { _id: '$contactKey', rejectedAttemptCount: { $sum: 1 } } },
  ]);

  const map = new Map();
  for (const entry of grouped) {
    map.set(entry._id, entry.rejectedAttemptCount);
  }
  return map;
}

function filterContactKeys(countMap, { minOccurrences, maxOccurrences }) {
  const min = minOccurrences ? parseInt(minOccurrences, 10) : null;
  const max = maxOccurrences ? parseInt(maxOccurrences, 10) : null;

  return [...countMap.entries()]
    .filter(([, rejectedCount]) => {
      const totalApplied = getTotalTimesApplied(rejectedCount);
      if (min && totalApplied < min) return false;
      if (max && totalApplied > max) return false;
      return true;
    })
    .map(([contactKey]) => contactKey);
}

export async function listDuplicateLeads(options = {}) {
  const {
    page = 1,
    limit = 50,
    sortOccurrences = 'recent',
    minOccurrences,
    maxOccurrences,
  } = options;

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);

  const countMap = await getRejectedAttemptCountMap();
  const allowedContactKeys = filterContactKeys(countMap, { minOccurrences, maxOccurrences });

  if (!allowedContactKeys.length) {
    return {
      duplicateLeads: [],
      totalCount: 0,
      totalPages: 1,
      page: safePage,
      limit: safeLimit,
    };
  }

  const docs = await DuplicateLead.find({ contactKey: { $in: allowedContactKeys } })
    .populate('matchedLeadId', 'firstName lastName status')
    .sort({ receivedAt: -1 })
    .lean();

  const latestByContactKey = new Map();
  for (const doc of docs) {
    if (!latestByContactKey.has(doc.contactKey)) {
      latestByContactKey.set(doc.contactKey, doc);
    }
  }

  let rows = [...latestByContactKey.values()].map((doc) =>
    formatDuplicateLeadRow(doc, countMap.get(doc.contactKey) || 1)
  );

  if (sortOccurrences === 'most') {
    rows.sort(
      (a, b) =>
        b.submissionCount - a.submissionCount ||
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  } else if (sortOccurrences === 'least') {
    rows.sort(
      (a, b) =>
        a.submissionCount - b.submissionCount ||
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  } else {
    rows.sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }

  const totalCount = rows.length;
  const totalPages = Math.max(Math.ceil(totalCount / safeLimit), 1);
  const start = (safePage - 1) * safeLimit;
  const duplicateLeads = rows.slice(start, start + safeLimit);

  return {
    duplicateLeads,
    totalCount,
    totalPages,
    page: safePage,
    limit: safeLimit,
  };
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function buildDuplicateLeadsCsv(options = {}) {
  const { duplicateLeads } = await listDuplicateLeads({
    ...options,
    page: 1,
    limit: 100000,
  });

  const headers = [
    'First Name',
    'Last Name',
    'Phone',
    'Email',
    'State / City',
    'Driver Type',
    'Source',
    'Date',
    'Duplicate Reason',
    'Times Applied',
    'Ingestion Source',
    'Received At',
    'Matched Lead',
    'Matched Lead Status',
  ];

  const lines = [headers.join(',')];
  for (const row of duplicateLeads) {
    lines.push(
      [
        row.firstName,
        row.lastName,
        row.phone,
        row.email,
        row.stateCity,
        row.driverType,
        row.source,
        row.date,
        row.duplicateReason,
        row.submissionCount,
        row.ingestionSource,
        row.receivedAt ? new Date(row.receivedAt).toISOString() : '',
        row.matchedLead
          ? `${row.matchedLead.firstName || ''} ${row.matchedLead.lastName || ''}`.trim()
          : '',
        row.matchedLead?.status || '',
      ]
        .map(escapeCsvValue)
        .join(',')
    );
  }

  return `${lines.join('\n')}\n`;
}

export async function recordDuplicateLeadAttemptSafe(attempt, matchedLead) {
  try {
    return await recordDuplicateLeadAttempt(attempt, matchedLead);
  } catch (err) {
    console.error('[duplicate-leads] failed to record attempt', err.message);
    return null;
  }
}
