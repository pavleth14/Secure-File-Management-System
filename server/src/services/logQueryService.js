import { AuditLog } from '../models/AuditLog.js';
import { ROLES } from '../config/constants.js';

const SORT_FIELDS = {
  timestamp: 'timestamp',
  username: 'username',
  category: 'category',
  action: 'action',
};

export function canViewLog(viewerRole, log) {
  if (viewerRole === ROLES.SUPER_ADMIN) return true;
  if (viewerRole === ROLES.ADMIN) return log.userRole === ROLES.USER;
  return false;
}

export function buildLogQuery(params, viewerRole) {
  const {
    search,
    category,
    role,
    startDate,
    endDate,
    action,
  } = params;

  const query = {};

  if (category && category !== 'all') {
    query.category = category;
  }

  if (viewerRole === ROLES.ADMIN) {
    query.userRole = ROLES.USER;
  } else if (role && role !== 'all') {
    query.userRole = role;
  }

  if (action && action !== 'all') {
    query.action = action;
  }

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      query.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.timestamp.$lte = end;
    }
  }

  if (search?.trim()) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { username: regex },
      { targetName: regex },
      { action: regex },
      { details: regex },
      { userRole: regex },
    ];
  }

  return query;
}

export function getSortOptions(sortBy = 'timestamp', sortDir = 'desc') {
  const field = SORT_FIELDS[sortBy] || 'timestamp';
  const direction = sortDir === 'asc' ? 1 : -1;
  return { [field]: direction };
}

export async function queryLogs(params, viewerRole) {
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = [25, 50, 100].includes(parseInt(params.limit, 10))
    ? parseInt(params.limit, 10)
    : 25;

  const query = buildLogQuery(params, viewerRole);
  const sort = getSortOptions(params.sortBy, params.sortDir);
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query).sort(sort).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs: logs.map(formatLog),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    limit,
  };
}

export async function queryAllLogs(params, viewerRole) {
  const query = buildLogQuery(params, viewerRole);
  const sort = getSortOptions(params.sortBy, params.sortDir);
  const logs = await AuditLog.find(query).sort(sort).lean();
  return logs.map(formatLog);
}

export function formatLog(log) {
  return {
    id: log._id.toString(),
    userId: log.userId?.toString() || null,
    username: log.username,
    userRole: log.userRole,
    action: log.action,
    category: log.category,
    targetType: log.targetType,
    targetId: log.targetId,
    targetName: log.targetName,
    details: log.details,
    oldValues: log.oldValues,
    newValues: log.newValues,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    timestamp: log.timestamp,
    createdAt: log.createdAt,
  };
}

export function formatRoleDisplay(role) {
  const map = {
    [ROLES.SUPER_ADMIN]: 'Super Admin',
    [ROLES.ADMIN]: 'Admin',
    [ROLES.USER]: 'User',
  };
  return map[role] || role || '—';
}
