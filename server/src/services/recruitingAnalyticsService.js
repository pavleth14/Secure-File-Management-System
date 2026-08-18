import { Lead } from '../models/Lead.js';
import { OldLead } from '../models/OldLead.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES } from '../config/auditConstants.js';
import {
  getActiveLeadStatusNames,
  listLeadStatuses,
} from './leadStatusService.js';
import { isRecruitingModuleUser } from '../utils/recruitingPermissions.js';
import { formatLeadDateIso } from '../utils/leadDateFormat.js';
import {
  computeResponseTimeMs,
  getLeadStartTime,
  isWithinRange,
} from '../utils/leadResponseTime.js';

const LOCAL_DRIVER_TYPE = 'Local';
const OTR_DRIVER_TYPES = ['Solo', 'Team', 'Owner Operator'];
const HIRED_STATUS = 'Hired';
const NEGATIVE_OUTCOME_STATUSES = [
  'Rejected',
  'Invalid Lead',
  'Female',
  'No Experience',
  'SAP',
  'Local Driver',
];
const STALE_DAYS = 7;

function canViewAllRecruiterAnalytics(user) {
  return Boolean(
    user?.isRecruitingManager ||
    user?.role === 'SUPER_ADMIN' ||
    isRecruitingModuleUser(user)
  );
}

function parseDateRange(from, to) {
  const dateFrom = from ? new Date(from) : null;
  const dateTo = to ? new Date(to) : null;

  if (dateFrom && Number.isNaN(dateFrom.getTime())) {
    const err = new Error('Invalid from date');
    err.status = 400;
    throw err;
  }

  if (dateTo && Number.isNaN(dateTo.getTime())) {
    const err = new Error('Invalid to date');
    err.status = 400;
    throw err;
  }

  if (dateTo) {
    dateTo.setHours(23, 59, 59, 999);
  }

  return { dateFrom, dateTo };
}

function buildDriverTypeFilter(driverTypeGroup) {
  if (driverTypeGroup === 'local') {
    return { driverType: LOCAL_DRIVER_TYPE };
  }
  if (driverTypeGroup === 'otr') {
    return { driverType: { $in: OTR_DRIVER_TYPES } };
  }
  return {};
}

function buildRecruiterScopeFilter(user) {
  if (canViewAllRecruiterAnalytics(user)) {
    return {};
  }
  if (user?.isRecruiter) {
    return { assignedRecruiter: user._id };
  }
  const err = new Error('Recruiting analytics access required');
  err.status = 403;
  throw err;
}

function buildCreatedAtRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};
  const createdAt = {};
  if (dateFrom) createdAt.$gte = dateFrom;
  if (dateTo) createdAt.$lte = dateTo;
  return { createdAt };
}

function buildImportedAtRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};
  const importedAt = {};
  if (dateFrom) importedAt.$gte = dateFrom;
  if (dateTo) importedAt.$lte = dateTo;
  return { importedAt };
}

function buildArchivedAtRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};
  const archivedAt = {};
  if (dateFrom) archivedAt.$gte = dateFrom;
  if (dateTo) archivedAt.$lte = dateTo;
  return { archivedAt };
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

async function countLeads(filter) {
  return Lead.countDocuments(filter);
}

async function aggregateByField(filter, field) {
  const rows = await Lead.aggregate([
    { $match: filter },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((row) => ({
    name: row._id || 'Unknown',
    count: row.count,
  }));
}

async function aggregateStatusBreakdown(filter) {
  const statuses = await listLeadStatuses();
  const statusMeta = new Map(
    statuses.map((status) => [status.name, { isActive: Boolean(status.isActive) }])
  );
  const rows = await aggregateByField(filter, 'status');
  return rows.map((row) => ({
    status: row.name,
    count: row.count,
    isActive: statusMeta.get(row.name)?.isActive ?? false,
  }));
}

async function aggregateRecruiterStatusCounts(baseFilter) {
  const statuses = await listLeadStatuses();
  const rows = await Lead.aggregate([
    { $match: { ...baseFilter, archived: false } },
    {
      $group: {
        _id: { recruiter: '$assignedRecruiter', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);

  const byRecruiter = new Map();
  for (const row of rows) {
    const recruiterId = row._id?.recruiter?.toString?.();
    if (!recruiterId) continue;
    if (!byRecruiter.has(recruiterId)) {
      byRecruiter.set(recruiterId, new Map());
    }
    byRecruiter.get(recruiterId).set(row._id.status || 'Unknown', row.count);
  }

  return { byRecruiter, statuses };
}

function buildRecruiterStatusBreakdown(recruiterId, byRecruiter, statuses) {
  const counts = byRecruiter.get(recruiterId?.toString?.()) || new Map();
  return statuses.map((status) => ({
    status: status.name,
    count: counts.get(status.name) || 0,
    isActive: Boolean(status.isActive),
  }));
}

function buildRecruiterStatusColumns(statuses) {
  return statuses.map((status) => ({
    name: status.name,
    isActive: Boolean(status.isActive),
  }));
}

async function getOverviewMetrics(baseFilter, periodFilter, dateFrom, dateTo) {
  const activeLeads = await countLeads({ ...baseFilter, archived: false });
  const newLeads = await countLeads({ ...baseFilter, ...periodFilter });
  const importedLeads = await countLeads({
    ...baseFilter,
    importedAt: { $ne: null },
    ...buildImportedAtRange(dateFrom, dateTo),
  });
  const archivedLeads = await countLeads({
    ...baseFilter,
    archived: true,
    ...buildArchivedAtRange(dateFrom, dateTo),
  });
  const hired = await countLeads({
    ...baseFilter,
    status: HIRED_STATUS,
    ...periodFilter,
  });
  const rejectedOutcomes = await countLeads({
    ...baseFilter,
    status: { $in: NEGATIVE_OUTCOME_STATUSES },
    ...periodFilter,
  });

  const activeStatusNames = await getActiveLeadStatusNames();
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const staleLeads = await countLeads({
    ...baseFilter,
    archived: false,
    status: { $in: activeStatusNames },
    updatedAt: { $lt: staleCutoff },
  });

  return {
    activeLeads,
    newLeads,
    importedLeads,
    archivedLeads,
    hired,
    rejectedOutcomes,
    conversionRate: pct(hired, hired + rejectedOutcomes),
    staleLeads,
  };
}

async function getSourceAnalytics(baseFilter, periodFilter) {
  const rows = await Lead.aggregate([
    { $match: { ...baseFilter, ...periodFilter } },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        hired: {
          $sum: {
            $cond: [{ $eq: ['$status', HIRED_STATUS] }, 1, 0],
          },
        },
        rejected: {
          $sum: {
            $cond: [{ $in: ['$status', NEGATIVE_OUTCOME_STATUSES] }, 1, 0],
          },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return rows.map((row) => ({
    source: row._id || 'Unknown',
    count: row.count,
    hired: row.hired,
    rejected: row.rejected,
    conversionRate: pct(row.hired, row.hired + row.rejected),
  }));
}

async function getRecruiterAnalyticsSimple(baseFilter, periodFilter, viewAll, statusCounts) {
  if (!viewAll) {
    return [];
  }

  const { byRecruiter, statuses } = statusCounts;
  const recruiters = await User.find({ isRecruiter: true }).sort({ name: 1 }).select('name');
  const results = [];

  for (const recruiter of recruiters) {
    const recruiterFilter = { ...baseFilter, assignedRecruiter: recruiter._id };
    const active = await countLeads({ ...recruiterFilter, archived: false });
    const newInPeriod = await countLeads({ ...recruiterFilter, ...periodFilter });
    const hired = await countLeads({
      ...recruiterFilter,
      status: HIRED_STATUS,
      ...periodFilter,
    });
    const rejected = await countLeads({
      ...recruiterFilter,
      status: { $in: NEGATIVE_OUTCOME_STATUSES },
      ...periodFilter,
    });
    const local = await countLeads({
      ...recruiterFilter,
      driverType: LOCAL_DRIVER_TYPE,
      archived: false,
    });
    const otr = await countLeads({
      ...recruiterFilter,
      driverType: { $in: OTR_DRIVER_TYPES },
      archived: false,
    });

    results.push({
      id: recruiter._id,
      name: recruiter.name,
      active,
      newInPeriod,
      hired,
      rejected,
      conversionRate: pct(hired, hired + rejected),
      local,
      otr,
      statusBreakdown: buildRecruiterStatusBreakdown(recruiter._id, byRecruiter, statuses),
    });
  }

  return results;
}

async function getSelfRecruiterAnalytics(user, baseFilter, periodFilter, statusCounts) {
  const { byRecruiter, statuses } = statusCounts;
  const recruiterFilter = { ...baseFilter, assignedRecruiter: user._id };
  const active = await countLeads({ ...recruiterFilter, archived: false });
  const newInPeriod = await countLeads({ ...recruiterFilter, ...periodFilter });
  const hired = await countLeads({
    ...recruiterFilter,
    status: HIRED_STATUS,
    ...periodFilter,
  });
  const rejected = await countLeads({
    ...recruiterFilter,
    status: { $in: NEGATIVE_OUTCOME_STATUSES },
    ...periodFilter,
  });

  return [
    {
      id: user._id,
      name: user.name,
      active,
      newInPeriod,
      hired,
      rejected,
      conversionRate: pct(hired, hired + rejected),
      local: await countLeads({
        ...recruiterFilter,
        driverType: LOCAL_DRIVER_TYPE,
        archived: false,
      }),
      otr: await countLeads({
        ...recruiterFilter,
        driverType: { $in: OTR_DRIVER_TYPES },
        archived: false,
      }),
      statusBreakdown: buildRecruiterStatusBreakdown(user._id, byRecruiter, statuses),
    },
  ];
}

async function getOldLeadsAnalytics(dateFrom, dateTo) {
  const total = await OldLead.countDocuments({});
  const unassigned = await OldLead.countDocuments({ assignment: null });
  const assigned = total - unassigned;

  const assignedInPeriodFilter = {
    'assignment.assignedAt': {},
  };
  if (dateFrom) assignedInPeriodFilter['assignment.assignedAt'].$gte = dateFrom;
  if (dateTo) assignedInPeriodFilter['assignment.assignedAt'].$lte = dateTo;

  const assignedInPeriod =
    dateFrom || dateTo
      ? await OldLead.countDocuments(assignedInPeriodFilter)
      : assigned;

  const now = Date.now();
  const unassignedOlderThan7Days = await OldLead.countDocuments({
    assignment: null,
    createdAt: { $lt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
  });
  const unassignedOlderThan30Days = await OldLead.countDocuments({
    assignment: null,
    createdAt: { $lt: new Date(now - 30 * 24 * 60 * 60 * 1000) },
  });

  const byDriverType = await OldLead.aggregate([
    { $group: { _id: '$driverType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return {
    total,
    unassigned,
    assigned,
    assignedInPeriod,
    unassignedOlderThan7Days,
    unassignedOlderThan30Days,
    byDriverType: byDriverType.map((row) => ({
      driverType: row._id || 'Unknown',
      count: row.count,
    })),
  };
}

async function getRejectionReasons(baseFilter, periodFilter) {
  const rows = await Lead.aggregate([
    {
      $match: {
        ...baseFilter,
        ...periodFilter,
        rejectionReason: { $nin: [null, ''] },
      },
    },
    { $group: { _id: '$rejectionReason', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ]);

  return rows.map((row) => ({
    reason: row._id,
    count: row.count,
  }));
}

async function getRoundRobinBalance(baseFilter, periodFilter, viewAll) {
  if (!viewAll) return [];

  const rows = await Lead.aggregate([
    {
      $match: {
        ...baseFilter,
        ...periodFilter,
        importedAt: { $ne: null },
      },
    },
    { $group: { _id: '$assignedRecruiter', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const userIds = rows.map((row) => row._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } }).select('name');
  const nameById = new Map(users.map((user) => [user._id.toString(), user.name]));

  return rows.map((row) => ({
    recruiterId: row._id,
    name: nameById.get(row._id?.toString()) || 'Unknown',
    assignedInPeriod: row.count,
  }));
}

async function getReassignments(dateFrom, dateTo, viewAll) {
  if (!viewAll) return 0;

  const timestamp = {};
  if (dateFrom) timestamp.$gte = dateFrom;
  if (dateTo) timestamp.$lte = dateTo;

  return AuditLog.countDocuments({
    action: AUDIT_ACTIONS.LEAD_REASSIGN,
    category: AUDIT_CATEGORIES.RECRUITING,
    ...(Object.keys(timestamp).length ? { timestamp } : {}),
  });
}

async function getPipeline(baseFilter) {
  const statuses = await listLeadStatuses();
  const breakdown = await aggregateStatusBreakdown({ ...baseFilter, archived: false });
  const countByStatus = new Map(breakdown.map((row) => [row.status, row.count]));

  return statuses.map((status) => ({
    status: status.name,
    count: countByStatus.get(status.name) || 0,
    isActive: Boolean(status.isActive),
  }));
}

async function getResponseTimeAnalytics(baseFilter, dateFrom, dateTo) {
  const leads = await Lead.find(baseFilter)
    .select('importedAt createdAt assignedRecruiter firstCalledAt')
    .populate('assignedRecruiter', 'name')
    .lean();

  const durations = [];

  for (const lead of leads) {
    const result = computeResponseTimeMs(lead);
    if (!result) continue;
    if (!isWithinRange(result.calledAt, dateFrom, dateTo)) continue;

    const recruiter = lead.assignedRecruiter;
    durations.push({
      durationMs: result.durationMs,
      recruiterId: recruiter?._id?.toString() || null,
      recruiterName: recruiter?.name || 'Unknown',
    });
  }

  const averageResponseTimeMs = durations.length
    ? Math.round(durations.reduce((sum, row) => sum + row.durationMs, 0) / durations.length)
    : null;

  const recruiterMap = new Map();
  for (const row of durations) {
    const key = row.recruiterId || 'unknown';
    if (!recruiterMap.has(key)) {
      recruiterMap.set(key, {
        id: row.recruiterId,
        name: row.recruiterName,
        totalMs: 0,
        count: 0,
      });
    }
    const bucket = recruiterMap.get(key);
    bucket.totalMs += row.durationMs;
    bucket.count += 1;
  }

  const responseTimeByRecruiter = [...recruiterMap.values()]
    .map((row) => ({
      id: row.id,
      name: row.name,
      averageResponseTimeMs: Math.round(row.totalMs / row.count),
      count: row.count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    averageResponseTimeMs,
    averageResponseTimeCount: durations.length,
    responseTimeByRecruiter,
  };
}

async function getLongestWaitingNewLeads(baseFilter, limit = 100) {
  const leads = await Lead.find({
    ...baseFilter,
    archived: false,
    status: 'New Lead',
  })
    .select(
      'firstName lastName phone email stateCity status driverType source date importedAt createdAt assignedRecruiter'
    )
    .populate('assignedRecruiter', 'name')
    .lean();

  const now = Date.now();

  return leads
    .map((lead) => {
      const waitingSince = getLeadStartTime(lead);
      const waitingMs = waitingSince ? Math.max(0, now - waitingSince.getTime()) : 0;
      const recruiter = lead.assignedRecruiter;

      return {
        id: lead._id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        email: lead.email,
        stateCity: lead.stateCity || '',
        status: lead.status,
        driverType: lead.driverType,
        source: lead.source,
        date: formatLeadDateIso(lead.date, lead.createdAt),
        recruiterId: recruiter?._id || null,
        recruiterName: recruiter?.name || 'Unknown',
        waitingMs,
        waitingSince: waitingSince ? waitingSince.toISOString() : null,
      };
    })
    .sort((a, b) => b.waitingMs - a.waitingMs)
    .slice(0, limit);
}

export async function getRecruitingAnalytics(user, options = {}) {
  const { dateFrom, dateTo } = parseDateRange(options.from, options.to);
  const driverTypeGroup = options.driverTypeGroup || 'all';
  const viewAll = canViewAllRecruiterAnalytics(user);

  const scopeFilter = buildRecruiterScopeFilter(user);
  const driverTypeFilter = buildDriverTypeFilter(driverTypeGroup);
  const baseFilter = { ...scopeFilter, ...driverTypeFilter };
  const periodFilter = buildCreatedAtRange(dateFrom, dateTo);

  const overview = await getOverviewMetrics(baseFilter, periodFilter, dateFrom, dateTo);
  const byStatus = await aggregateStatusBreakdown({ ...baseFilter, ...periodFilter });
  const bySource = await getSourceAnalytics(baseFilter, periodFilter);
  const byDriverType = await aggregateByField({ ...baseFilter, ...periodFilter }, 'driverType');
  const pipeline = await getPipeline(baseFilter);
  const recruiterStatusCounts = await aggregateRecruiterStatusCounts(baseFilter);
  const recruiters = viewAll
    ? await getRecruiterAnalyticsSimple(baseFilter, periodFilter, viewAll, recruiterStatusCounts)
    : await getSelfRecruiterAnalytics(user, baseFilter, periodFilter, recruiterStatusCounts);
  const oldLeads = viewAll ? await getOldLeadsAnalytics(dateFrom, dateTo) : null;
  const rejectionReasons = await getRejectionReasons(baseFilter, periodFilter);
  const roundRobinBalance = await getRoundRobinBalance(baseFilter, periodFilter, viewAll);
  const reassignments = await getReassignments(dateFrom, dateTo, viewAll);
  const responseTime = await getResponseTimeAnalytics(baseFilter, dateFrom, dateTo);
  const longestWaitingNewLeads = await getLongestWaitingNewLeads(baseFilter);

  if (viewAll && oldLeads) {
    overview.oldLeadsAssigned = oldLeads.assignedInPeriod;
  }

  overview.averageResponseTimeMs = responseTime.averageResponseTimeMs;
  overview.averageResponseTimeCount = responseTime.averageResponseTimeCount;

  return {
    scope: viewAll ? 'all' : 'self',
    period: {
      from: dateFrom ? dateFrom.toISOString() : null,
      to: dateTo ? dateTo.toISOString() : null,
    },
    driverTypeGroup,
    overview,
    byStatus,
    bySource,
    byDriverType: byDriverType.map((row) => ({
      driverType: row.name,
      count: row.count,
    })),
    pipeline,
    recruiters,
    recruiterStatusColumns: buildRecruiterStatusColumns(recruiterStatusCounts.statuses),
    oldLeads,
    rejectionReasons,
    roundRobinBalance,
    reassignments,
    responseTimeByRecruiter: responseTime.responseTimeByRecruiter,
    longestWaitingNewLeads,
  };
}
