import { AuditLog } from '../models/AuditLog.js';
import { getRequestMeta } from '../utils/requestMeta.js';

function formatRoleLabel(role) {
  if (!role) return 'Unknown';
  const labels = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    USER: 'User',
  };
  return labels[role] || role;
}

function resolveUserFields(user) {
  if (!user) {
    return { userId: null, username: 'System', userRole: null };
  }
  return {
    userId: user._id || user.id || null,
    username: user.name || user.email || 'Unknown',
    userRole: user.role || null,
  };
}

/**
 * Centralized audit logging service.
 * Fire-and-forget — errors are logged but never block the request.
 */
export async function auditLog({
  user = null,
  action,
  category,
  targetType = null,
  targetId = null,
  targetName = null,
  details = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  req = null,
}) {
  try {
    const meta = req ? getRequestMeta(req) : { ipAddress, userAgent };
    const userFields = resolveUserFields(user);

    await AuditLog.create({
      ...userFields,
      action,
      category,
      targetType,
      targetId: targetId?.toString?.() || targetId || null,
      targetName,
      details,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress || ipAddress,
      userAgent: meta.userAgent || userAgent,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

export function buildActorLabel(user) {
  if (!user) return 'System';
  return `${formatRoleLabel(user.role)} ${user.name}`;
}

export function formatPermissionsList(perms) {
  if (!perms?.length) return 'None';
  return perms
    .map((p) => {
      const actions = (p.allowedActions || []).join(', ');
      const folder = p.folderId?.name || p.folderId || 'folder';
      const sub = p.subfolderId ? ` / ${p.subfolderId?.name || p.subfolderId}` : '';
      return `${folder}${sub}: ${actions}`;
    })
    .join('; ');
}
