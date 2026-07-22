import validator from 'validator';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import {
  LEAD_STATUSES,
  DRIVER_TYPES,
  LEAD_PERSONAL_INFO_EDIT_WINDOW_MS,
  LEAD_COMMENT_EDIT_WINDOW_MS,
  DEFAULT_LEAD_STATUS,
} from '../config/recruitingConstants.js';
import { assertValidLeadSource } from './leadSourceService.js';
import { isRecruitingModuleUser, canMutateLead, canViewLeadOnRecruiterBoard } from '../utils/recruitingPermissions.js';

const PERSONAL_INFO_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'stateCity'];
const IMMUTABLE_FIELDS = ['source', 'createdAt', 'updatedAt', 'importedAt'];
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
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
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
    driverType: lead.driverType,
    source: lead.source,
    date: lead.date || '',
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
    createdAt: lead.createdAt,
    importedAt: lead.importedAt,
    updatedAt: lead.updatedAt,
  };
  // Temporary date import debugging
  if (formatted.date) {
    console.log('[DATE-IMPORT] formatLead API response', {
      leadId: formatted.id,
      date: formatted.date,
    });
  }
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
    .populate('assignedRecruiter', 'name isRecruiter')
    .populate('archivedBy', 'name')
    .populate('comments.author', 'name');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LEAD_SORT_FIELDS = {
  status: 'status',
  date: 'createdAt',
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
  archivedAt: 'archivedAt',
};

function applyLeadListFilters(filter, options) {
  const {
    search = '',
    status,
    driverType,
    source,
    dateFrom,
    dateTo,
  } = options;

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), 'i');
    filter.$or = [
      { firstName: regex },
      { lastName: regex },
      { phone: regex },
      { email: regex },
      { stateCity: regex },
      { source: regex },
    ];
  }

  if (status) filter.status = status;
  if (driverType) filter.driverType = driverType;
  if (source) filter.source = source;

  if (dateFrom || dateTo) {
    const dateField = options.useArchivedDate ? 'archivedAt' : 'createdAt';
    filter[dateField] = {};
    if (dateFrom) {
      filter[dateField].$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      filter[dateField].$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }
}

async function queryLeadList(filter, options) {
  const { page = 1, limit = 25, sortBy = 'createdAt', sortDir = 'desc', listMode = true } = options;

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
    query = query.select({ comments: { $slice: -1 } });
  }

  const [totalCount, leads] = await Promise.all([Lead.countDocuments(filter), populateLead(query)]);

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

  applyLeadListFilters(filter, options);

  return queryLeadList(filter, { ...options, listMode: true });
}

export async function getLeadById(leadId, { listMode = false } = {}) {
  let query = Lead.findById(leadId);
  if (listMode) {
    query = query.select({ comments: { $slice: -1 } });
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

export async function createLead(user, payload) {
  const {
    firstName,
    lastName,
    phone,
    email,
    stateCity,
    status,
    driverType,
    source,
    assignedRecruiterId,
  } = payload;

  if (!firstName || !lastName || !phone || !email || !driverType || !source) {
    const err = new Error('firstName, lastName, phone, email, driverType, and source are required');
    err.status = 400;
    throw err;
  }

  assertValidLeadEmail(email);
  assertEnumValue(driverType, DRIVER_TYPES, 'driver type');
  await assertValidLeadSource(source);

  if (status !== undefined) {
    assertEnumValue(status, LEAD_STATUSES, 'status');
  }

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

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  await assertNoDuplicateLead(normalizedEmail, normalizedPhone);

  const lead = await Lead.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: normalizedPhone,
    email: normalizedEmail,
    stateCity: stateCity?.trim() || '',
    status: status || DEFAULT_LEAD_STATUS,
    driverType,
    source,
    assignedRecruiter,
  });

  return getLeadById(lead._id);
}

function validateLeadUpdate(user, lead, updates) {
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
    assertEnumValue(updates.status, LEAD_STATUSES, 'status');
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
}

export async function updateLead(user, lead, updates) {
  validateLeadUpdate(user, lead, updates);

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
  if (updates.status !== undefined) lead.status = updates.status;
  if (updates.driverType !== undefined) lead.driverType = updates.driverType;

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

export async function assignLead(user, lead, recruiterId) {
  if (!user.isRecruitingManager && user.role !== 'SUPER_ADMIN') {
    const err = new Error('Recruiting manager access required');
    err.status = 403;
    throw err;
  }

  await assertRecruiterUser(recruiterId);
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
