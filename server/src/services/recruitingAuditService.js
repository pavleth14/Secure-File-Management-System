import { auditLog, buildActorLabel } from './auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';

function leadLabel(lead) {
  if (!lead) return 'Lead';
  return `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Lead';
}

export async function auditLeadCreated({ user, lead, req, details }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_CREATE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id,
    targetName: leadLabel(lead),
    details: details || `${buildActorLabel(user)} created lead ${leadLabel(lead)}`,
    newValues: {
      email: lead.email,
      phone: lead.phone,
      assignedRecruiter: lead.assignedRecruiter?.toString?.() || lead.assignedRecruiter,
    },
    req,
  });
}

export async function auditLeadImported({ user, summary, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_IMPORT,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetName: 'CSV Import',
    details: `${buildActorLabel(user)} imported ${summary.imported} leads (${summary.skippedDuplicates} duplicates skipped, ${summary.invalidRows} invalid)`,
    newValues: summary,
    req,
  });
}

export async function auditLeadUpdated({ user, lead, req, oldValues, newValues }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_UPDATE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id,
    targetName: leadLabel(lead),
    details: `${buildActorLabel(user)} updated lead ${leadLabel(lead)}`,
    oldValues,
    newValues,
    req,
  });
}

export async function auditLeadReassigned({ user, lead, req, oldRecruiterId, newRecruiterId }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_REASSIGN,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id,
    targetName: leadLabel(lead),
    details: `${buildActorLabel(user)} reassigned lead ${leadLabel(lead)}`,
    oldValues: { assignedRecruiter: oldRecruiterId },
    newValues: { assignedRecruiter: newRecruiterId },
    req,
  });
}

export async function auditLeadArchived({ user, lead, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_ARCHIVE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id,
    targetName: leadLabel(lead),
    details: `${buildActorLabel(user)} archived lead ${leadLabel(lead)}`,
    req,
  });
}

export async function auditLeadCommentAdded({ user, lead, req, commentText }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_COMMENT_ADD,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id,
    targetName: leadLabel(lead),
    details: `${buildActorLabel(user)} added a comment on lead ${leadLabel(lead)}`,
    newValues: { comment: commentText },
    req,
  });
}

export async function auditLeadCommentEdited({ user, lead, req, oldText, newText }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_COMMENT_EDIT,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id,
    targetName: leadLabel(lead),
    details: `${buildActorLabel(user)} edited a comment on lead ${leadLabel(lead)}`,
    oldValues: { comment: oldText },
    newValues: { comment: newText },
    req,
  });
}

export async function auditLeadSourceCreated({ user, sourceName, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_SOURCE_CREATE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD_SOURCE,
    targetName: sourceName,
    details: `${buildActorLabel(user)} added lead source "${sourceName}"`,
    newValues: { name: sourceName },
    req,
  });
}
