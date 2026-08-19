import { AuditLog } from '../models/AuditLog.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES } from '../config/auditConstants.js';
import {
  RECRUITER_DISQUALIFICATION_STATUSES,
  SAFETY_DISQUALIFICATION_STATUSES,
  PROCESSING_STEPS,
} from '../config/recruitingConstants.js';
import { chicagoStartOfDay, chicagoEndOfDay } from '../utils/chicagoTime.js';

function assertAnalyticsAccess(user) {
  if (user?.isRecruitingManager || user?.role === 'SUPER_ADMIN') {
    return;
  }
  const err = new Error('Recruiting analytics access required');
  err.status = 403;
  throw err;
}

function parsePeriodBounds(from, to) {
  const fromStr = String(from || '').trim();
  const toStr = String(to || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    const err = new Error('from and to must be YYYY-MM-DD dates');
    err.status = 400;
    throw err;
  }
  const start = chicagoStartOfDay(fromStr);
  const end = chicagoEndOfDay(toStr);
  if (start.getTime() > end.getTime()) {
    const err = new Error('from must be on or before to');
    err.status = 400;
    throw err;
  }
  return { from: start, to: end, fromStr, toStr };
}

async function countStatusTransitions(status, from, to) {
  return AuditLog.countDocuments({
    action: AUDIT_ACTIONS.LEAD_STATUS_CHANGE,
    category: AUDIT_CATEGORIES.RECRUITING,
    timestamp: { $gte: from, $lte: to },
    'newValues.status': status,
  });
}

async function countDisqualificationsByStatus(statuses, from, to) {
  const rows = await AuditLog.aggregate([
    {
      $match: {
        action: AUDIT_ACTIONS.LEAD_STATUS_CHANGE,
        category: AUDIT_CATEGORIES.RECRUITING,
        timestamp: { $gte: from, $lte: to },
        'newValues.status': { $in: statuses },
      },
    },
    {
      $group: {
        _id: '$newValues.status',
        count: { $sum: 1 },
      },
    },
  ]);

  const byReason = {};
  for (const status of statuses) {
    byReason[status] = 0;
  }
  for (const row of rows) {
    byReason[row._id] = row.count;
  }
  const total = Object.values(byReason).reduce((sum, value) => sum + value, 0);
  return { byReason, total };
}

async function getProcessingStepSaveCounts(from, to) {
  const rows = await Lead.aggregate([
    { $unwind: '$processingStepHistory' },
    {
      $match: {
        'processingStepHistory.savedAt': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$processingStepHistory.stepKey',
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  return PROCESSING_STEPS.map((step) => ({
    stepKey: step.key,
    label: step.label,
    count: countMap[step.key] || 0,
  }));
}

function computeStepIntervalsForLead(lead, from, to) {
  const history = [...(lead.processingStepHistory || [])].sort(
    (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
  );

  const intervals = [];
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    const current = history[index];
    const currentSavedAt = new Date(current.savedAt);
    if (currentSavedAt < from || currentSavedAt > to) {
      continue;
    }
    const durationMs =
      currentSavedAt.getTime() - new Date(previous.savedAt).getTime();
    if (durationMs >= 0) {
      intervals.push({
        durationMs,
        recruiterId: lead.assignedRecruiter?.toString?.() || String(lead.assignedRecruiter),
        fromStepKey: previous.stepKey,
        toStepKey: current.stepKey,
      });
    }
  }
  return intervals;
}

async function getProcessingStepIntervalAnalytics(from, to) {
  const leads = await Lead.find({
    'processingStepHistory.0': { $exists: true },
  })
    .select('assignedRecruiter processingStepHistory')
    .lean();

  const recruiterTotals = new Map();
  const allDurations = [];

  for (const lead of leads) {
    const intervals = computeStepIntervalsForLead(lead, from, to);
    for (const interval of intervals) {
      allDurations.push(interval.durationMs);
      const recruiterId = interval.recruiterId;
      if (!recruiterTotals.has(recruiterId)) {
        recruiterTotals.set(recruiterId, []);
      }
      recruiterTotals.get(recruiterId).push(interval.durationMs);
    }
  }

  const recruiterIds = [...recruiterTotals.keys()];
  const recruiters = recruiterIds.length
    ? await User.find({ _id: { $in: recruiterIds } }).select('name').lean()
    : [];
  const recruiterNameMap = Object.fromEntries(
    recruiters.map((recruiter) => [recruiter._id.toString(), recruiter.name])
  );

  const byRecruiter = recruiterIds
    .map((recruiterId) => {
      const durations = recruiterTotals.get(recruiterId) || [];
      const totalMs = durations.reduce((sum, value) => sum + value, 0);
      return {
        recruiterId,
        recruiterName: recruiterNameMap[recruiterId] || 'Unknown',
        intervalCount: durations.length,
        averageMs: durations.length ? Math.round(totalMs / durations.length) : null,
      };
    })
    .sort((a, b) => a.recruiterName.localeCompare(b.recruiterName));

  const overallTotalMs = allDurations.reduce((sum, value) => sum + value, 0);

  return {
    overallAverageMs: allDurations.length
      ? Math.round(overallTotalMs / allDurations.length)
      : null,
    intervalCount: allDurations.length,
    byRecruiter,
  };
}

export async function getRecruitingAnalytics(user, options = {}) {
  assertAnalyticsAccess(user);

  const { from, to, fromStr, toStr } = parsePeriodBounds(options.from, options.to);

  const [processingCount, hiredCount, recruiterDisqualified, safetyDisqualified, processingSteps] =
    await Promise.all([
      countStatusTransitions('Processing', from, to),
      countStatusTransitions('Hired', from, to),
      countDisqualificationsByStatus(RECRUITER_DISQUALIFICATION_STATUSES, from, to),
      countDisqualificationsByStatus(SAFETY_DISQUALIFICATION_STATUSES, from, to),
      getProcessingStepSaveCounts(from, to),
    ]);

  const processingStepIntervals = await getProcessingStepIntervalAnalytics(from, to);

  return {
    period: {
      from: fromStr,
      to: toStr,
      timezone: 'America/Chicago',
    },
    processing: {
      count: processingCount,
    },
    disqualified: {
      recruiter: recruiterDisqualified,
      safety: safetyDisqualified,
      total: recruiterDisqualified.total + safetyDisqualified.total,
    },
    hired: {
      count: hiredCount,
    },
    processingSteps,
    processingStepIntervals,
  };
}
