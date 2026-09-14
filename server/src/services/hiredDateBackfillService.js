import { Lead } from '../models/Lead.js';
import { PROCESSING_STEP_HIRED_KEY } from '../config/recruitingConstants.js';
import { formatLeadDateIso } from '../utils/leadDateFormat.js';

const HIRED_STATUS_COMMENT_PATTERN = /\bto Hired\b|\bStatus set to Hired\b/i;
const HIRED_DATE_IN_COMMENT_PATTERN = /Hired date:\s*(\d{4}-\d{2}-\d{2})/i;

export function resolveHiredDateFromLeadRecord(lead) {
  const existing = formatLeadDateIso(lead.hiredDate);
  if (existing) {
    return existing;
  }

  if (lead.status !== 'Hired') {
    return null;
  }

  const systemComments = (lead.comments || [])
    .filter((comment) => comment.isSystem && HIRED_STATUS_COMMENT_PATTERN.test(comment.text || ''))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (systemComments.length) {
    const latest = systemComments[0];
    const fromCommentText = String(latest.text || '').match(HIRED_DATE_IN_COMMENT_PATTERN);
    if (fromCommentText?.[1]) {
      return formatLeadDateIso(fromCommentText[1]);
    }
    return formatLeadDateIso(latest.createdAt);
  }

  const hiredSteps = (lead.processingStepHistory || [])
    .filter((entry) => entry.stepKey === PROCESSING_STEP_HIRED_KEY)
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

  if (hiredSteps.length) {
    return formatLeadDateIso(hiredSteps[0].savedAt);
  }

  return null;
}

export async function backfillMissingHiredDates({ dryRun = false } = {}) {
  const leads = await Lead.find({
    status: 'Hired',
    $or: [{ hiredDate: null }, { hiredDate: '' }],
  }).select('status hiredDate comments processingStepHistory');

  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    const resolved = resolveHiredDateFromLeadRecord(lead);
    if (!resolved) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      lead.hiredDate = resolved;
      await lead.save();
    }
    updated += 1;
  }

  return {
    scanned: leads.length,
    updated,
    skipped,
    dryRun,
  };
}
