import { Lead } from '../models/Lead.js';
import { DuplicateLead } from '../models/DuplicateLead.js';
import {
  buildDuplicateContactKey,
  recordDuplicateLeadAttempt,
} from './duplicateLeadService.js';
import {
  isMissingLeadEmail,
  normalizeLeadContactEmail,
  normalizeLeadContactPhoneDigits,
} from '../utils/leadDuplicateContact.js';

function leadContactKey(lead) {
  return buildDuplicateContactKey({
    email: lead.email,
    phone: lead.phone,
    emailMissing: isMissingLeadEmail(lead.email),
  });
}

async function existingDuplicateKeys() {
  const keys = new Set();
  const docs = await DuplicateLead.find().select('contactKey matchedLeadId receivedAt').lean();
  for (const doc of docs) {
    keys.add(`${doc.contactKey}:${doc.matchedLeadId}:${doc.receivedAt?.getTime?.() || 0}`);
  }
  return keys;
}

/**
 * Retroactively populate duplicateleads from leads that share phone or email.
 * Keeps the oldest lead as the canonical board entry; newer duplicates become attempts.
 */
export async function backfillDuplicateLeadsFromExistingLeads({ dryRun = false } = {}) {
  const leads = await Lead.find({ archived: { $ne: true } })
    .select('_id firstName lastName phone phoneDigits email stateCity driverType source date createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const byPhone = new Map();
  const byEmail = new Map();

  for (const lead of leads) {
    const phoneDigits = lead.phoneDigits || normalizeLeadContactPhoneDigits(lead.phone);
    if (phoneDigits) {
      if (!byPhone.has(phoneDigits)) byPhone.set(phoneDigits, []);
      byPhone.get(phoneDigits).push(lead);
    }

    const email = normalizeLeadContactEmail(lead.email);
    if (email && !isMissingLeadEmail(email)) {
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(lead);
    }
  }

  const duplicatePairs = [];
  const seenPair = new Set();

  function addPair(canonical, duplicate, reason) {
    const key = `${canonical._id}:${duplicate._id}`;
    if (seenPair.has(key) || canonical._id.toString() === duplicate._id.toString()) {
      return;
    }
    seenPair.add(key);
    duplicatePairs.push({ canonical, duplicate, reason });
  }

  for (const group of byPhone.values()) {
    if (group.length < 2) continue;
    const [canonical, ...rest] = group;
    for (const duplicate of rest) {
      addPair(canonical, duplicate, 'phone');
    }
  }

  for (const group of byEmail.values()) {
    if (group.length < 2) continue;
    const [canonical, ...rest] = group;
    for (const duplicate of rest) {
      addPair(canonical, duplicate, 'email');
    }
  }

  const existingKeys = dryRun ? new Set() : await existingDuplicateKeys();
  let scanned = duplicatePairs.length;
  let created = 0;
  let skipped = 0;

  for (const { canonical, duplicate, reason } of duplicatePairs) {
    const contactKey = leadContactKey(duplicate);
    const dedupeKey = `${contactKey}:${canonical._id}:${duplicate.createdAt?.getTime?.() || 0}`;
    if (existingKeys.has(dedupeKey)) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      created += 1;
      continue;
    }

    await recordDuplicateLeadAttempt(
      {
        firstName: duplicate.firstName,
        lastName: duplicate.lastName,
        phone: duplicate.phone,
        email: duplicate.email,
        stateCity: duplicate.stateCity,
        driverType: duplicate.driverType,
        source: duplicate.source,
        date: duplicate.date,
        emailMissing: isMissingLeadEmail(duplicate.email),
        duplicateReason: reason,
        ingestionSource: 'csv_import',
        ingestionMeta: { backfill: true, duplicateLeadId: duplicate._id },
        receivedAt: duplicate.createdAt,
      },
      canonical
    );
    created += 1;
  }

  return { scanned, created, skipped, dryRun };
}
