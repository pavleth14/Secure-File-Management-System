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

export async function auditLeadExported({ user, summary, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_EXPORT,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetName: 'Lead Export',
    details: `${buildActorLabel(user)} exported ${summary.rowCount} active leads (${summary.scopeLabel}, ${summary.format})`,
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

export async function auditLeadStatusChanged({
  user,
  lead,
  req,
  oldStatus,
  newStatus,
  rejectionReason = null,
}) {
  const trimmedReason = rejectionReason ? String(rejectionReason).trim() : '';
  const details = oldStatus
    ? `${buildActorLabel(user)} changed status from ${oldStatus} to ${newStatus} for ${leadLabel(lead)}`
    : `${buildActorLabel(user)} set status to ${newStatus} for ${leadLabel(lead)}`;

  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_STATUS_CHANGE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id || lead.id,
    targetName: leadLabel(lead),
    details: trimmedReason ? `${details} (Reason: ${trimmedReason})` : details,
    oldValues: oldStatus ? { status: oldStatus } : {},
    newValues: {
      status: newStatus,
      ...(trimmedReason ? { rejectionReason: trimmedReason } : {}),
    },
    req,
  });
}

export async function auditLeadProcessingStepChanged({
  user,
  lead,
  req,
  oldStep,
  newStep,
}) {
  const oldLabel = oldStep ? String(oldStep) : 'none';
  const newLabel = newStep ? String(newStep) : 'none';

  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_PROCESSING_STEP_CHANGE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id || lead.id,
    targetName: leadLabel(lead),
    details: `${buildActorLabel(user)} changed processing step from ${oldLabel} to ${newLabel} for ${leadLabel(lead)}`,
    oldValues: oldStep ? { processingStep: oldStep } : {},
    newValues: newStep ? { processingStep: newStep } : {},
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

export async function auditLeadRestored({ user, lead, req, recruiterId = null }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_RESTORE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD,
    targetId: lead._id,
    targetName: leadLabel(lead),
    details: recruiterId
      ? `${buildActorLabel(user)} restored lead ${leadLabel(lead)} to an active board`
      : `${buildActorLabel(user)} restored lead ${leadLabel(lead)} to an active board`,
    newValues: recruiterId ? { assignedRecruiter: recruiterId } : {},
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

export async function auditLeadSourceDeleted({ user, sourceName, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_SOURCE_DELETE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD_SOURCE,
    targetName: sourceName,
    details: `${buildActorLabel(user)} deleted lead source "${sourceName}"`,
    oldValues: { name: sourceName },
    req,
  });
}

export async function auditLeadStatusCreated({ user, statusName, isActive, color, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_STATUS_CREATE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD_STATUS,
    targetName: statusName,
    details: `${buildActorLabel(user)} added lead status "${statusName}" (${isActive ? 'Active' : 'Non-active'})`,
    newValues: { name: statusName, isActive, color },
    req,
  });
}

export async function auditLeadStatusUpdated({ user, statusName, oldValues, newValues, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_STATUS_UPDATE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD_STATUS,
    targetName: statusName,
    details: `${buildActorLabel(user)} updated lead status "${statusName}"`,
    oldValues,
    newValues,
    req,
  });
}

export async function auditLeadStatusDeleted({ user, statusName, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.LEAD_STATUS_DELETE,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.LEAD_STATUS,
    targetName: statusName,
    details: `${buildActorLabel(user)} deleted lead status "${statusName}"`,
    oldValues: { name: statusName },
    req,
  });
}

function oldLeadLabel(oldLead) {
  if (!oldLead) return 'Old Lead';
  return `${oldLead.firstName || ''} ${oldLead.lastName || ''}`.trim() || 'Old Lead';
}

export async function auditOldLeadImported({ user, summary, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.OLD_LEAD_IMPORT,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.OLD_LEAD,
    targetName: 'Old Leads CSV Import',
    details: `${buildActorLabel(user)} imported ${summary.imported} old leads (${summary.skippedDuplicates} duplicates skipped, ${summary.invalidRows} invalid)`,
    newValues: summary,
    req,
  });
}

export async function auditOldLeadAssigned({ user, oldLead, recruiterName, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.OLD_LEAD_ASSIGN,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.OLD_LEAD,
    targetId: oldLead.id || oldLead._id,
    targetName: oldLeadLabel(oldLead),
    details: `${buildActorLabel(user)} assigned old lead ${oldLeadLabel(oldLead)} to ${recruiterName}`,
    newValues: { recruiterName, leadId: oldLead.assignment?.leadId },
    req,
  });
}

export async function auditOldLeadsRoundRobinAssigned({ user, summary, req }) {
  await auditLog({
    user,
    action: AUDIT_ACTIONS.OLD_LEAD_ROUND_ROBIN_ASSIGN,
    category: AUDIT_CATEGORIES.RECRUITING,
    targetType: TARGET_TYPES.OLD_LEAD,
    targetName: 'Round Robin Assignment',
    details: `${buildActorLabel(user)} round-robin assigned ${summary.assigned} old leads (${summary.failed} failed)`,
    newValues: summary,
    req,
  });
}
