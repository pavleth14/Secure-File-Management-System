import validator from 'validator';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import {
  DRIVER_TYPES,
  LEAD_PERSONAL_INFO_EDIT_WINDOW_MS,
  LEAD_COMMENT_EDIT_WINDOW_MS,
  DEFAULT_LEAD_STATUS,
  MANUAL_LEAD_SOURCE,
} from '../config/recruitingConstants.js';
import { assertValidLeadSource } from './leadSourceService.js';
import {
  assertValidLeadStatus,
  getActiveLeadStatusNames,
  getInactiveLeadStatusNames,
} from './leadStatusService.js';
import { appendStatusChangeComment } from './leadStatusChangeService.js';
import {
  validateProcessingStepTransition,
  isValidProcessingStep,
  resolveProcessingStepIndex,
  PROCESSING_STEP_HIRED_KEY,
  PROCESSING_STEP_KEYS,
} from './processingStepService.js';
import { appendReassignmentComment } from './leadReassignmentService.js';
import { auditLeadStatusChanged, auditLeadProcessingStepChanged } from './recruitingAuditService.js';
import { isRecruitingModuleUser, canMutateLead, canViewLeadOnRecruiterBoard } from '../utils/recruitingPermissions.js';
import { formatLeadDateIso } from '../utils/leadDateFormat.js';
import { generateImportPlaceholderEmail } from '../utils/importPlaceholderEmail.js';
import { notifyNewLeadSlack } from './slackNotificationService.js';
import { buildLeadSearchOrConditions } from '../utils/leadPhoneSearch.js';
import { normalizeUsPhoneDigits } from '../utils/usPhone.js';
import {
  backfillRingCentralEventsForLead,
  formatRingCentralEvent,
  repairStaleCallEventDurations,
  scheduleRepairForLeadsWithUnsyncedCalls,
} from './ringCentralEventService.js';

const PERSONAL_INFO_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'stateCity'];
const IMMUTABLE_FIELDS = ['source', 'createdAt', 'updatedAt', 'importedAt'];
/** Recent comments loaded on board list — enough to resolve latest user comment after system entries */
const LIST_MODE_COMMENT_SLICE = 50;
const MAX_COMMENT_LENGTH = 2000;

export function canViewLead(user, lead) {
  return canViewLeadOnRecruiterBoard(user, lead);
}

export function canAccessLead(user, lead) {
  return canMutateLead(user, lead);
}

export function isWithinPersonalInfoEditWindow(lead) {
  if (!lead?.importedAt) return false;

  const referenceTime =
    lead.importedAt instanceof Date
      ? lead.importedAt.getTime()
      : new Date(lead.importedAt).getTime();
  if (Number.isNaN(referenceTime)) return false;

  const now = Date.now();
  const timeDifferenceMs = now - referenceTime;
  const withinWindow = timeDifferenceMs <= LEAD_PERSONAL_INFO_EDIT_WINDOW_MS;

  console.log('[PERSONAL-INFO-EDIT-WINDOW]', {
    leadId: lead._id?.toString?.() || lead.id,
    importedAt: lead.importedAt,
    currentTime: new Date(now).toISOString(),
    timeDifferenceMs,
    editWindowMs: LEAD_PERSONAL_INFO_EDIT_WINDOW_MS,
    withinWindow,
  });

  return withinWindow;
}

export function isWithinCommentEditWindow(comment) {
  const createdAt =
    comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt);
  return Date.now() - createdAt.getTime() <= LEAD_COMMENT_EDIT_WINDOW_MS;
}

function formatComment(comment) {
  const authorDoc = comment.author;
  const authorName =
    authorDoc && typeof authorDoc === 'object' && authorDoc.name
      ? authorDoc.name
      : null;

  return {
    id: comment._id,
    text: comment.text,
    author: comment.authorLabel || authorName,
    authorId: authorDoc?._id || authorDoc,
    isSystem: Boolean(comment.isSystem),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

function findLatestUserComment(comments) {
  let latest = null;
  for (const comment of comments || []) {
    if (comment?.isSystem) continue;
    if (!latest || new Date(comment.createdAt).getTime() > new Date(latest.createdAt).getTime()) {
      latest = comment;
    }
  }
  return latest ? formatComment(latest) : null;
}

function formatExtraFields(extraFields) {
  if (!extraFields) return {};
  if (extraFields instanceof Map) {
    return Object.fromEntries(extraFields.entries());
  }
  if (typeof extraFields === 'object') {
    return { ...extraFields };
  }
  return {};
}

function formatProcessingStepHistoryEntry(entry) {
  const savedBy = entry.savedBy;
  return {
    id: entry._id,
    stepKey: entry.stepKey,
    savedAt: entry.savedAt,
    savedBy: {
      id: savedBy?._id || savedBy,
      name: savedBy?.name || null,
    },
  };
}

export function formatLead(lead) {
  const recruiter = lead.assignedRecruiter;
  const formatted = {
    id: lead._id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    email: lead.email,
    stateCity: lead.stateCity,
    status: lead.status,
    rejectionReason: lead.rejectionReason || null,
    processingStep: lead.processingStep || null,
    processingStepIndex: lead.processingStepIndex ?? null,
    processingStepHistory: (lead.processingStepHistory || []).map(formatProcessingStepHistoryEntry),
    driverType: lead.driverType,
    source: lead.source,
    date: formatLeadDateIso(lead.date, lead.createdAt) || '',
    assignedRecruiter: {
      id: recruiter?._id || recruiter,
      name: recruiter?.name || null,
    },
    archived: lead.archived,
    archivedAt: lead.archivedAt,
    archivedBy: lead.archivedBy
      ? {
          id: lead.archivedBy._id || lead.archivedBy,
          name: lead.archivedBy.name || null,
        }
      : null,
    comments: (lead.comments || []).map(formatComment),
    latestUserComment: findLatestUserComment(lead.comments),
    ringCentralEvents: (lead.ringCentralEvents || []).map(formatRingCentralEvent),
    firstCalledAt: lead.firstCalledAt || null,
    extraFields: formatExtraFields(lead.extraFields),
    createdAt: lead.createdAt,
    importedAt: lead.importedAt,
    updatedAt: lead.updatedAt,
  };
  return formatted;
}

function normalizePhone(phone) {
  return String(phone).trim();
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function isValidLeadEmail(email) {
  return validator.isEmail(email, { allow_utf8_local_part: false });
}

function assertValidLeadEmail(email) {
  if (!isValidLeadEmail(email)) {
    const err = new Error('Please enter a valid email address');
    err.status = 400;
    throw err;
  }
}

function assertEnumValue(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    const err = new Error(`Invalid ${fieldName}`);
    err.status = 400;
    throw err;
  }
}

async function assertRecruiterUser(userId) {
  const recruiter = await User.findById(userId).select('isRecruiter name');
  if (!recruiter?.isRecruiter) {
    const err = new Error('Assigned user must be a recruiter');
    err.status = 400;
    throw err;
  }
  return recruiter;
}

export async function findDuplicateLead(email, phone, excludeLeadId = null) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  const orConditions = [{ email: normalizedEmail }, { phone: normalizedPhone }];
  const filter = excludeLeadId
    ? { $or: orConditions, _id: { $ne: excludeLeadId } }
    : { $or: orConditions };

  return Lead.findOne(filter).select('email phone');
}

export async function assertNoDuplicateLead(email, phone, excludeLeadId = null) {
  const duplicate = await findDuplicateLead(email, phone, excludeLeadId);
  if (!duplicate) return;

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (duplicate.email === normalizedEmail) {
    const err = new Error('A lead with this email already exists');
    err.status = 409;
    throw err;
  }

  if (duplicate.phone === normalizedPhone) {
    const err = new Error('A lead with this phone number already exists');
    err.status = 409;
    throw err;
  }
}

async function populateLead(query) {
  return query
    .populate('assignedRecruiter', 'name isRecruiter ringCentralExtensionId')
    .populate('archivedBy', 'name')
    .populate('comments.author', 'name')
    .populate('ringCentralEvents.author', 'name')
    .populate('processingStepHistory.savedBy', 'name');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LEAD_SORT_FIELDS = {
  status: 'status',
  date: 'date',
  createdAt: 'createdAt',
  name: 'lastName',
  firstName: 'firstName',
  lastName: 'lastName',
  phone: 'phone',
  email: 'email',
  source: 'source',
  driverType: 'driverType',
  stateCity: 'stateCity',
  recruiter: 'assignedRecruiter',
  processingStep: 'processingStepIndex',
  archivedAt: 'archivedAt',
};

function applyLeadListFilters(filter, options) {
  const {
    search = '',
    status,
    statusIn,
    driverType,
    source,
    dateFrom,
    dateTo,
  } = options;

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    filter.$or = buildLeadSearchOrConditions(trimmedSearch, escapeRegex);
  }

  if (status) {
    filter.status = status;
  } else if (Array.isArray(statusIn) && statusIn.length) {
    filter.status = { $in: statusIn };
  } else if (Array.isArray(statusIn)) {
    filter.status = { $in: ['__no_matching_status__'] };
  }
  if (driverType) filter.driverType = driverType;
  if (source) filter.source = source;

  if (dateFrom || dateTo) {
    if (options.useArchivedDate) {
      filter.archivedAt = {};
      if (dateFrom) {
        filter.archivedAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        filter.archivedAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    } else {
      filter.date = {};
      if (dateFrom) {
        filter.date.$gte = dateFrom;
      }
      if (dateTo) {
        filter.date.$lte = dateTo;
      }
    }
  }
}

function buildProcessingStepSortSwitch() {
  const branches = [
    {
      case: {
        $or: [{ $eq: ['$processingStep', null] }, { $eq: ['$processingStep', ''] }],
      },
      then: 0,
    },
  ];

  for (let index = 0; index < PROCESSING_STEP_KEYS.length; index += 1) {
    branches.push({
      case: { $eq: ['$processingStep', PROCESSING_STEP_KEYS[index]] },
      then: index + 1,
    });
  }

  return { $switch: { branches, default: 0 } };
}

async function queryLeadListSortedByProcessingStep(filter, options) {
  const { page = 1, limit = 25, sortDir = 'asc', listMode = true } = options;
  const sortOrder = sortDir === 'asc' ? 1 : -1;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [totalCount, aggResults] = await Promise.all([
    Lead.countDocuments(filter),
    Lead.aggregate([
      { $match: filter },
      { $addFields: { _processingStepSort: buildProcessingStepSortSwitch() } },
      { $sort: { _processingStepSort: sortOrder, _id: sortOrder } },
      { $skip: skip },
      { $limit: safeLimit },
      { $project: { _id: 1 } },
    ]),
  ]);

  const ids = aggResults.map((row) => row._id);
  if (!ids.length) {
    return {
      leads: [],
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages: Math.max(Math.ceil(totalCount / safeLimit), 1),
    };
  }

  let query = Lead.find({ _id: { $in: ids } });
  if (listMode) {
    query = query.select({
      comments: { $slice: -LIST_MODE_COMMENT_SLICE },
      ringCentralEvents: { $slice: -1 },
    });
  }

  const leads = await populateLead(query);
  const leadsById = new Map(leads.map((lead) => [lead._id.toString(), lead]));
  const orderedLeads = ids.map((id) => leadsById.get(id.toString())).filter(Boolean);

  if (listMode) {
    scheduleRepairForLeadsWithUnsyncedCalls(orderedLeads);
  }

  return {
    leads: orderedLeads,
    page: safePage,
    limit: safeLimit,
    totalCount,
    totalPages: Math.max(Math.ceil(totalCount / safeLimit), 1),
  };
}

async function queryLeadList(filter, options) {
  const { page = 1, limit = 25, sortBy = 'createdAt', sortDir = 'desc', listMode = true } = options;

  if (sortBy === 'processingStep') {
    return queryLeadListSortedByProcessingStep(filter, options);
  }

  const sortField = LEAD_SORT_FIELDS[sortBy] || 'createdAt';
  const sortOrder = sortDir === 'asc' ? 1 : -1;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  let query = Lead.find(filter)
    .sort({ [sortField]: sortOrder, _id: sortOrder })
    .skip(skip)
    .limit(safeLimit);

  if (listMode) {
    query = query.select({
      comments: { $slice: -LIST_MODE_COMMENT_SLICE },
      ringCentralEvents: { $slice: -1 },
    });
  }

  const [totalCount, leads] = await Promise.all([Lead.countDocuments(filter), populateLead(query)]);

  if (listMode) {
    scheduleRepairForLeadsWithUnsyncedCalls(leads);
  }

  return {
    leads,
    page: safePage,
    limit: safeLimit,
    totalCount,
    totalPages: Math.max(Math.ceil(totalCount / safeLimit), 1),
  };
}

export async function listActiveLeads(user, options = {}) {
  const {
    recruiterId,
    page = 1,
    limit = 25,
    search = '',
    status,
    driverType,
    source,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortDir = 'desc',
    activityGroup,
  } = options;

  const filter = { archived: false };

  if (user.isRecruitingManager || user.role === 'SUPER_ADMIN') {
    if (recruiterId) {
      filter.assignedRecruiter = recruiterId;
    }
  } else if (isRecruitingModuleUser(user)) {
    if (recruiterId) {
      filter.assignedRecruiter = recruiterId;
    }
  } else if (user.isRecruiter) {
    if (recruiterId) {
      filter.assignedRecruiter = recruiterId;
    } else {
      filter.assignedRecruiter = user._id;
    }
  } else {
    const err = new Error('Recruiting access required');
    err.status = 403;
    throw err;
  }

  let statusIn;
  if (!status && activityGroup === 'active') {
    statusIn = await getActiveLeadStatusNames();
  } else if (!status && activityGroup === 'non-active') {
    statusIn = await getInactiveLeadStatusNames();
  }

  applyLeadListFilters(filter, { ...options, statusIn });

  return queryLeadList(filter, { ...options, listMode: true });
}

export async function getLeadById(leadId, { listMode = false } = {}) {
  if (!listMode) {
    try {
      await repairStaleCallEventDurations(leadId);
    } catch (err) {
      console.error('[ringcentral] repair stale durations failed', leadId, err.message);
    }
  }

  let query = Lead.findById(leadId);
  if (listMode) {
    query = query.select({
      comments: { $slice: -LIST_MODE_COMMENT_SLICE },
      ringCentralEvents: { $slice: -1 },
    });
  }
  return populateLead(query);
}

export async function listArchivedLeads(user, options = {}) {
  if (!user.isRecruitingManager && user.role !== 'SUPER_ADMIN') {
    const err = new Error('Recruiting manager access required');
    err.status = 403;
    throw err;
  }

  const filter = { archived: true };
  if (options.recruiterId) {
    filter.assignedRecruiter = options.recruiterId;
  }
  applyLeadListFilters(filter, { ...options, useArchivedDate: true });

  const sortBy = options.sortBy === 'date' ? 'archivedAt' : options.sortBy || 'archivedAt';
  return queryLeadList(filter, {
    ...options,
    sortBy,
    sortDir: options.sortDir || 'desc',
    listMode: true,
  });
}

export async function createLead(user, payload, { req } = {}) {
  const {
    firstName,
    lastName,
    phone,
    email,
    stateCity,
    status,
    driverType,
    source,
    date,
    assignedRecruiterId,
  } = payload;

  if (!firstName?.trim() || !lastName?.trim() || !phone?.trim()) {
    const err = new Error('firstName, lastName, and phone are required');
    err.status = 400;
    throw err;
  }

  const emailRaw = String(email || '').trim();
  const emailMissing = !emailRaw;
  if (!emailMissing) {
    assertValidLeadEmail(emailRaw);
  }

  const resolvedDriverType = driverType || 'Solo';
  assertEnumValue(resolvedDriverType, DRIVER_TYPES, 'driver type');

  const resolvedSource = source || MANUAL_LEAD_SOURCE;
  await assertValidLeadSource(resolvedSource);

  const resolvedStatus = status || DEFAULT_LEAD_STATUS;
  await assertValidLeadStatus(resolvedStatus);

  let assignedRecruiter = user._id;

  if (user.isRecruitingManager || user.role === 'SUPER_ADMIN') {
    if (assignedRecruiterId) {
      await assertRecruiterUser(assignedRecruiterId);
      assignedRecruiter = assignedRecruiterId;
    } else {
      const err = new Error('assignedRecruiterId is required when creating a lead as a manager');
      err.status = 400;
      throw err;
    }
  } else if (!user.isRecruiter) {
    const err = new Error('Recruiting access required');
    err.status = 403;
    throw err;
  }

  const normalizedEmail = emailMissing
    ? generateImportPlaceholderEmail()
    : normalizeEmail(emailRaw);
  const normalizedPhone = normalizePhone(phone);

  if (emailMissing) {
    const duplicateByPhone = await Lead.findOne({ phone: normalizedPhone }).select('_id');
    if (duplicateByPhone) {
      const err = new Error('A lead with this phone number already exists');
      err.status = 409;
      throw err;
    }
  } else {
    await assertNoDuplicateLead(normalizedEmail, normalizedPhone);
  }

  const createdAt = new Date();
  const leadDoc = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: normalizedPhone,
    phoneDigits: normalizeUsPhoneDigits(normalizedPhone),
    email: normalizedEmail,
    stateCity: stateCity?.trim() || '',
    status: resolvedStatus,
    driverType: resolvedDriverType,
    source: resolvedSource,
    date: date ? formatLeadDateIso(date, createdAt) : formatLeadDateIso(null, createdAt),
    assignedRecruiter,
    comments: [],
    createdAt,
    updatedAt: createdAt,
  };

  appendStatusChangeComment(leadDoc, {
    userId: user._id,
    oldStatus: null,
    newStatus: resolvedStatus,
  });

  const lead = await Lead.create(leadDoc);

  if (req) {
    await auditLeadStatusChanged({
      user,
      lead,
      req,
      oldStatus: null,
      newStatus: resolvedStatus,
    });
  }

  const createdLead = await getLeadById(lead._id);
  notifyNewLeadSlack(createdLead, { sourceLabel: resolvedSource });
  backfillRingCentralEventsForLead(lead._id).catch((err) => {
    console.error('[ringcentral] createLead backfill failed', lead._id, err.message);
  });

  return createdLead;
}

async function validateLeadUpdate(user, lead, updates) {
  if (!canMutateLead(user, lead)) {
    const err = new Error('Access denied to modify this lead');
    err.status = 403;
    throw err;
  }

  const rejectedFields = [];

  for (const field of IMMUTABLE_FIELDS) {
    if (updates[field] !== undefined) {
      rejectedFields.push(field);
    }
  }

  if (rejectedFields.length > 0) {
    const err = new Error(`These fields cannot be modified: ${rejectedFields.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const personalInfoChanges = PERSONAL_INFO_FIELDS.filter(
    (field) => updates[field] !== undefined
  );

  if (personalInfoChanges.length > 0) {
    const withinWindow = isWithinPersonalInfoEditWindow(lead);
    const hasManagerBypass = Boolean(
      user.isRecruitingManager || user.role === 'SUPER_ADMIN'
    );
    if (!withinWindow && !hasManagerBypass) {
      const err = new Error(
        'Personal information can only be edited within 24 hours of lead creation'
      );
      err.status = 403;
      throw err;
    }
  }

  if (
    updates.driverType !== undefined &&
    user.isRecruiter &&
    !user.isRecruitingManager &&
    !isWithinPersonalInfoEditWindow(lead)
  ) {
    const err = new Error(
      'Driver type can only be edited within 24 hours of import'
    );
    err.status = 403;
    throw err;
  }

  if (isRecruitingModuleUser(user)) {
    if (updates.status !== undefined || updates.driverType !== undefined) {
      const err = new Error('Status and driver type cannot be edited with your access level');
      err.status = 403;
      throw err;
    }
  }

  if (updates.status !== undefined) {
    await assertValidLeadStatus(updates.status);
  }

  if (updates.driverType !== undefined) {
    assertEnumValue(updates.driverType, DRIVER_TYPES, 'driver type');
  }

  if (updates.email !== undefined) {
    assertValidLeadEmail(updates.email);
  }

  if (updates.phone !== undefined && !normalizePhone(updates.phone)) {
    const err = new Error('Phone is required');
    err.status = 400;
    throw err;
  }

  const effectiveStatus = updates.status !== undefined ? updates.status : lead.status;
  if (effectiveStatus === 'Rejected') {
    const reason =
      updates.rejectionReason !== undefined ? updates.rejectionReason : lead.rejectionReason;
    if (!reason || !String(reason).trim()) {
      const err = new Error('Rejection reason is required when status is Rejected');
      err.status = 400;
      throw err;
    }
  }

  if (updates.processingStep !== undefined && updates.processingStep !== null) {
    const step = String(updates.processingStep).trim();
    if (step && !isValidProcessingStep(step)) {
      const err = new Error('Invalid processing step');
      err.status = 400;
      throw err;
    }
    const effectiveProcessingStatus =
      updates.status !== undefined ? updates.status : lead.status;
    if (step && effectiveProcessingStatus !== 'Processing' && step !== PROCESSING_STEP_HIRED_KEY) {
      const err = new Error('Processing steps can only be set while status is Processing');
      err.status = 400;
      throw err;
    }
    if (
      step &&
      !validateProcessingStepTransition(lead.processingStep || null, step)
    ) {
      const err = new Error('Invalid processing step transition');
      err.status = 400;
      throw err;
    }
  }
}

export async function updateLead(user, lead, updates, { req } = {}) {
  await validateLeadUpdate(user, lead, updates);

  const oldStatus = lead.status;

  const nextEmail =
    updates.email !== undefined ? normalizeEmail(updates.email) : lead.email;
  const nextPhone =
    updates.phone !== undefined ? normalizePhone(updates.phone) : lead.phone;

  if (updates.email !== undefined || updates.phone !== undefined) {
    await assertNoDuplicateLead(nextEmail, nextPhone, lead._id);
  }

  if (updates.firstName !== undefined) lead.firstName = updates.firstName.trim();
  if (updates.lastName !== undefined) lead.lastName = updates.lastName.trim();
  if (updates.phone !== undefined) lead.phone = nextPhone;
  if (updates.email !== undefined) lead.email = nextEmail;
  if (updates.stateCity !== undefined) lead.stateCity = updates.stateCity.trim();

  if (updates.processingStep !== undefined) {
    const nextStep = updates.processingStep ? String(updates.processingStep).trim() : null;
    const previousStep = lead.processingStep || null;

    if (nextStep !== previousStep) {
      if (nextStep) {
        const savedAt = new Date();
        if (!Array.isArray(lead.processingStepHistory)) {
          lead.processingStepHistory = [];
        }
        lead.processingStepHistory.push({
          stepKey: nextStep,
          savedAt,
          savedBy: user._id,
        });

        if (req) {
          await auditLeadProcessingStepChanged({
            user,
            lead,
            req,
            oldStep: previousStep,
            newStep: nextStep,
          });
        }

        if (nextStep === PROCESSING_STEP_HIRED_KEY) {
          updates.status = 'Hired';
        }
      }

      lead.processingStep = nextStep === PROCESSING_STEP_HIRED_KEY ? null : nextStep;
    }
  }

  if (updates.status !== undefined) {
    const nextStatus = updates.status;
    if (nextStatus !== oldStatus) {
      const rejectionReasonForComment =
        nextStatus === 'Rejected'
          ? updates.rejectionReason !== undefined
            ? updates.rejectionReason
            : lead.rejectionReason
          : null;

      appendStatusChangeComment(lead, {
        userId: user._id,
        oldStatus,
        newStatus: nextStatus,
        rejectionReason: rejectionReasonForComment,
      });

      if (req) {
        await auditLeadStatusChanged({
          user,
          lead,
          req,
          oldStatus,
          newStatus: nextStatus,
          rejectionReason: rejectionReasonForComment,
        });
      }
    }

    lead.status = nextStatus;
    if (nextStatus !== 'Rejected') {
      lead.rejectionReason = null;
    }
    if (nextStatus !== 'Processing') {
      lead.processingStep = null;
    }
  }
  if (updates.rejectionReason !== undefined) {
    lead.rejectionReason = updates.rejectionReason
      ? String(updates.rejectionReason).trim()
      : null;
  }
  if (updates.driverType !== undefined) lead.driverType = updates.driverType;

  lead.processingStepIndex = resolveProcessingStepIndex(lead.status, lead.processingStep);

  await lead.save();
  return getLeadById(lead._id);
}

export async function addComment(user, lead, text) {
  if (!canMutateLead(user, lead)) {
    const err = new Error('Access denied to modify this lead');
    err.status = 403;
    throw err;
  }

  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const err = new Error('Comment text is required');
    err.status = 400;
    throw err;
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    const err = new Error(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
    err.status = 400;
    throw err;
  }

  lead.comments.push({
    text: trimmed,
    author: user._id,
  });

  await lead.save();
  return getLeadById(lead._id);
}

export async function editComment(user, lead, commentId, text) {
  if (!canMutateLead(user, lead)) {
    const err = new Error('Access denied to modify this lead');
    err.status = 403;
    throw err;
  }

  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const err = new Error('Comment text is required');
    err.status = 400;
    throw err;
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    const err = new Error(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
    err.status = 400;
    throw err;
  }

  const comment = lead.comments.id(commentId);
  if (!comment) {
    const err = new Error('Comment not found');
    err.status = 404;
    throw err;
  }

  if (comment.isSystem) {
    const err = new Error('System comments cannot be edited');
    err.status = 403;
    throw err;
  }

  if (comment.author.toString() !== user._id.toString()) {
    const err = new Error('Only the comment author can edit this comment');
    err.status = 403;
    throw err;
  }

  if (!isWithinCommentEditWindow(comment)) {
    const err = new Error('Comments can only be edited within 24 hours of creation');
    err.status = 403;
    throw err;
  }

  comment.text = trimmed;
  await lead.save();
  return getLeadById(lead._id);
}

async function resolveRecruiterName(assignedRecruiter) {
  if (!assignedRecruiter) return null;

  if (typeof assignedRecruiter === 'object' && assignedRecruiter.name) {
    return assignedRecruiter.name;
  }

  const recruiter = await User.findById(assignedRecruiter).select('name');
  return recruiter?.name || null;
}

export async function assignLead(user, lead, recruiterId) {
  if (!user.isRecruitingManager && user.role !== 'SUPER_ADMIN') {
    const err = new Error('Recruiting manager access required');
    err.status = 403;
    throw err;
  }

  const newRecruiter = await assertRecruiterUser(recruiterId);
  const oldRecruiterName = await resolveRecruiterName(lead.assignedRecruiter);

  appendReassignmentComment(lead, {
    userId: user._id,
    oldRecruiterName,
    newRecruiterName: newRecruiter.name,
  });

  lead.assignedRecruiter = recruiterId;
  await lead.save();
  return getLeadById(lead._id);
}

export async function archiveLead(user, lead) {
  if (!user.isRecruitingManager && user.role !== 'SUPER_ADMIN') {
    const err = new Error('Recruiting manager access required');
    err.status = 403;
    throw err;
  }

  if (lead.archived) {
    return getLeadById(lead._id);
  }

  lead.archived = true;
  lead.archivedAt = new Date();
  lead.archivedBy = user._id;
  await lead.save();
  return getLeadById(lead._id);
}

async function isActiveRecruiterAssignee(recruiterId) {
  if (!recruiterId) return false;
  const recruiter = await User.findById(recruiterId).select('isRecruiter');
  return Boolean(recruiter?.isRecruiter);
}

export async function archiveLeadsForDeletedRecruiter(deletedUserId, actorUser, deletedUserName) {
  const leads = await Lead.find({
    assignedRecruiter: deletedUserId,
    archived: false,
  });

  if (!leads.length) {
    return 0;
  }

  const timestamp = new Date();
  const commentText = `Auto-archived because recruiter ${deletedUserName} was deleted.`;

  for (const lead of leads) {
    lead.archived = true;
    lead.archivedAt = timestamp;
    lead.archivedBy = actorUser._id;
    lead.comments.push({
      text: commentText,
      author: actorUser._id,
      isSystem: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await lead.save();
  }

  return leads.length;
}

export async function countActiveLeadsForRecruiter(recruiterId) {
  return Lead.countDocuments({
    assignedRecruiter: recruiterId,
    archived: false,
  });
}

export async function unarchiveLead(user, lead) {
  if (!user.isRecruitingManager && user.role !== 'SUPER_ADMIN') {
    const err = new Error('Recruiting manager access required');
    err.status = 403;
    throw err;
  }

  if (!lead.archived) {
    return getLeadById(lead._id);
  }

  const assigneeId = lead.assignedRecruiter?.toString?.() || lead.assignedRecruiter;
  const assigneeIsActive = await isActiveRecruiterAssignee(assigneeId);
  if (!assigneeIsActive) {
    const err = new Error(
      'This lead must be reassigned to an active recruiter before it can be restored'
    );
    err.status = 400;
    throw err;
  }

  lead.archived = false;
  lead.archivedAt = null;
  lead.archivedBy = null;
  await lead.save();
  return getLeadById(lead._id);
}

export async function restoreLead(user, lead, recruiterId) {
  if (!user.isRecruitingManager && user.role !== 'SUPER_ADMIN') {
    const err = new Error('Recruiting manager access required');
    err.status = 403;
    throw err;
  }

  if (!lead.archived) {
    return getLeadById(lead._id);
  }

  const currentAssigneeId =
    lead.assignedRecruiter?._id?.toString?.() ||
    lead.assignedRecruiter?.toString?.() ||
    null;
  const assigneeIsActive = await isActiveRecruiterAssignee(currentAssigneeId);

  if (!assigneeIsActive) {
    if (!recruiterId) {
      const err = new Error('assignedRecruiterId is required to restore this lead');
      err.status = 400;
      throw err;
    }
    await assignLead(user, lead, recruiterId);
  } else if (recruiterId && recruiterId.toString() !== currentAssigneeId) {
    await assignLead(user, lead, recruiterId);
  }

  const leadDoc = await Lead.findById(lead._id);
  leadDoc.archived = false;
  leadDoc.archivedAt = null;
  leadDoc.archivedBy = null;
  await leadDoc.save();
  return getLeadById(leadDoc._id);
}

export function handleLeadDuplicateError(err) {
  if (err?.code !== 11000) return null;

  const keyPattern = err.keyPattern || {};
  if (keyPattern.email) {
    const duplicateErr = new Error('A lead with this email already exists');
    duplicateErr.status = 409;
    return duplicateErr;
  }
  if (keyPattern.phone) {
    const duplicateErr = new Error('A lead with this phone number already exists');
    duplicateErr.status = 409;
    return duplicateErr;
  }

  const duplicateErr = new Error('A lead with this email or phone already exists');
  duplicateErr.status = 409;
  return duplicateErr;
}
