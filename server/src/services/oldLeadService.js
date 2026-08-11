import { OldLead } from '../models/OldLead.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { DEFAULT_LEAD_STATUS } from '../config/recruitingConstants.js';
import { getRoundRobinAssignments } from './roundRobinService.js';
import { handleLeadDuplicateError } from './leadService.js';
import { prependStatusCommentsToLeadData } from './leadStatusChangeService.js';
import { prependReassignmentCommentToLeadData } from './leadReassignmentService.js';
import { auditLeadStatusChanged } from './recruitingAuditService.js';
import { formatLeadDateIso } from '../utils/leadDateFormat.js';
import { notifyNewLeadSlack } from './slackNotificationService.js';
import { buildLeadSearchOrConditions } from '../utils/leadPhoneSearch.js';

const OLD_LEAD_SOURCE = 'Old Leads';

const OLD_LEAD_SORT_FIELDS = {
  status: 'status',
  date: 'createdAt',
  createdAt: 'createdAt',
  firstName: 'firstName',
  lastName: 'lastName',
  phone: 'phone',
  email: 'email',
  source: 'source',
  driverType: 'driverType',
  stateCity: 'stateCity',
  assignment: 'assignment.assignedAt',
};

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyOldLeadListFilters(filter, options) {
  const { search = '', status, driverType, source, dateFrom, dateTo, assignmentStatus } =
    options;

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    filter.$or = buildLeadSearchOrConditions(trimmedSearch, escapeRegex);
  }

  if (status) filter.status = status;
  if (driverType) filter.driverType = driverType;
  if (source) filter.source = source;

  if (assignmentStatus === 'assigned') {
    filter['assignment.recruiterId'] = { $ne: null };
  } else if (assignmentStatus === 'unassigned') {
    filter.assignment = null;
  }

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) {
      filter.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      filter.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }
}

export function formatOldLead(oldLead) {
  const obj = oldLead.toObject ? oldLead.toObject() : oldLead;
  const assignment = obj.assignment;
  const recruiter = assignment?.recruiterId;

  return {
    id: obj._id,
    firstName: obj.firstName,
    lastName: obj.lastName,
    phone: obj.phone,
    email: obj.email,
    stateCity: obj.stateCity || '',
    status: obj.status,
    driverType: obj.driverType,
    source: obj.source,
    date: formatLeadDateIso(obj.date, obj.createdAt) || '',
    commentsText: obj.commentsText || '',
    importedAt: obj.importedAt,
    isAssigned: Boolean(assignment?.recruiterId),
    assignment: assignment
      ? {
          recruiterId: recruiter?._id || recruiter || null,
          recruiterName: recruiter?.name || null,
          assignedAt: assignment.assignedAt,
          assignedByName: assignment.assignedBy?.name || null,
          leadId: assignment.leadId?._id || assignment.leadId || null,
        }
      : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export async function listOldLeads(options = {}) {
  const {
    page = 1,
    limit = 25,
    search = '',
    status,
    driverType,
    source,
    dateFrom,
    dateTo,
    assignmentStatus,
    sortBy = 'createdAt',
    sortDir = 'desc',
  } = options;

  const filter = {};
  applyOldLeadListFilters(filter, {
    search,
    status,
    driverType,
    source,
    dateFrom,
    dateTo,
    assignmentStatus,
  });

  const sortField = OLD_LEAD_SORT_FIELDS[sortBy] || 'createdAt';
  const sortOrder = sortDir === 'asc' ? 1 : -1;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const sort = {};
  if (!assignmentStatus) {
    sort['assignment.recruiterId'] = 1;
  }
  sort[sortField] = sortOrder;
  sort._id = sortOrder;

  const [totalCount, oldLeads] = await Promise.all([
    OldLead.countDocuments(filter),
    OldLead.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .populate('assignment.recruiterId', 'name')
      .populate('assignment.assignedBy', 'name')
      .populate('assignment.leadId', '_id'),
  ]);

  return {
    oldLeads: oldLeads.map(formatOldLead),
    page: safePage,
    limit: safeLimit,
    totalCount,
    totalPages: Math.max(Math.ceil(totalCount / safeLimit), 1),
  };
}

async function assertRecruiterUser(recruiterId) {
  const recruiter = await User.findById(recruiterId).select('_id name isRecruiter');
  if (!recruiter?.isRecruiter) {
    const err = new Error('Selected user is not an active recruiter');
    err.status = 400;
    throw err;
  }
  return recruiter;
}

async function assignSingleOldLead(user, oldLeadId, recruiterId, req = null) {
  const oldLead = await OldLead.findById(oldLeadId);
  if (!oldLead) {
    const err = new Error('Old lead not found');
    err.status = 404;
    throw err;
  }

  if (oldLead.assignment?.recruiterId) {
    const err = new Error('This old lead has already been assigned');
    err.status = 409;
    throw err;
  }

  const existingLead = await Lead.findOne({
    $or: [{ email: oldLead.email }, { phone: oldLead.phone }],
  }).select('_id email phone');

  if (existingLead) {
    const err = new Error('A lead with this email or phone already exists in the system');
    err.status = 409;
    throw err;
  }

  const recruiter = await assertRecruiterUser(recruiterId);
  const assignedAt = new Date();
  const initialStatus = oldLead.status || DEFAULT_LEAD_STATUS;

  let leadData = {
    firstName: oldLead.firstName,
    lastName: oldLead.lastName,
    phone: oldLead.phone,
    email: oldLead.email,
    stateCity: oldLead.stateCity || '',
    status: initialStatus,
    driverType: oldLead.driverType,
    source: OLD_LEAD_SOURCE,
    date: formatLeadDateIso(oldLead.date, assignedAt) || '',
    assignedRecruiter: recruiter._id,
    createdAt: assignedAt,
    updatedAt: assignedAt,
    importedAt: assignedAt,
  };

  if (oldLead.commentsText) {
    leadData.comments = [
      {
        text: oldLead.commentsText,
        author: user._id,
        authorLabel: 'Old Leads Import',
        createdAt: assignedAt,
        updatedAt: assignedAt,
      },
    ];
  }

  leadData = prependStatusCommentsToLeadData(leadData, {
    userId: user._id,
    oldStatus: null,
    newStatus: initialStatus,
    timestamp: assignedAt,
  });

  leadData = prependReassignmentCommentToLeadData(leadData, {
    userId: user._id,
    newRecruiterName: recruiter.name,
    sourceLabel: OLD_LEAD_SOURCE,
    timestamp: assignedAt,
  });

  let lead;
  try {
    lead = await Lead.create(leadData);
  } catch (err) {
    const duplicateErr = handleLeadDuplicateError(err);
    if (duplicateErr) throw duplicateErr;
    throw err;
  }

  notifyNewLeadSlack(
    {
      ...leadData,
      assignedRecruiter: { id: recruiter._id, name: recruiter.name },
    },
    { sourceLabel: OLD_LEAD_SOURCE, recruiterName: recruiter.name }
  );

  if (req) {
    await auditLeadStatusChanged({
      user,
      lead,
      req,
      oldStatus: null,
      newStatus: initialStatus,
    });
  }

  oldLead.assignment = {
    recruiterId: recruiter._id,
    assignedBy: user._id,
    assignedAt,
    leadId: lead._id,
  };
  await oldLead.save();

  return {
    oldLead: formatOldLead(
      await OldLead.findById(oldLead._id)
        .populate('assignment.recruiterId', 'name')
        .populate('assignment.assignedBy', 'name')
        .populate('assignment.leadId', '_id')
    ),
    leadId: lead._id,
    recruiterName: recruiter.name,
  };
}

export async function assignOldLeadsToRecruiter(user, oldLeadIds, recruiterId, req = null) {
  if (!Array.isArray(oldLeadIds) || !oldLeadIds.length) {
    const err = new Error('At least one old lead must be selected');
    err.status = 400;
    throw err;
  }

  await assertRecruiterUser(recruiterId);

  const results = {
    assigned: 0,
    failed: 0,
    errors: [],
    assignments: [],
  };

  for (const oldLeadId of oldLeadIds) {
    try {
      const result = await assignSingleOldLead(user, oldLeadId, recruiterId, req);
      results.assigned += 1;
      results.assignments.push(result);
    } catch (err) {
      results.failed += 1;
      results.errors.push({
        oldLeadId,
        message: err.message || 'Assignment failed',
      });
    }
  }

  if (!results.assigned) {
    const err = new Error(results.errors[0]?.message || 'No old leads were assigned');
    err.status = 400;
    err.details = results.errors;
    throw err;
  }

  return results;
}

export async function assignOldLeadsRoundRobin(user, oldLeadIds, req = null) {
  if (!Array.isArray(oldLeadIds) || !oldLeadIds.length) {
    const err = new Error('At least one old lead must be selected');
    err.status = 400;
    throw err;
  }

  const oldLeads = await OldLead.find({ _id: { $in: oldLeadIds } }).select('driverType');
  const oldLeadById = new Map(oldLeads.map((lead) => [lead._id.toString(), lead]));

  const recruiterAssignments = await getRoundRobinAssignments(
    oldLeadIds.map((oldLeadId) => {
      const oldLead = oldLeadById.get(oldLeadId.toString());
      if (!oldLead) {
        const err = new Error(`Old lead not found: ${oldLeadId}`);
        err.status = 404;
        throw err;
      }
      return { driverType: oldLead.driverType };
    })
  );

  const results = {
    assigned: 0,
    failed: 0,
    errors: [],
    assignments: [],
  };

  for (let index = 0; index < oldLeadIds.length; index += 1) {
    const oldLeadId = oldLeadIds[index];
    const recruiterId = recruiterAssignments[index];

    try {
      const result = await assignSingleOldLead(user, oldLeadId, recruiterId, req);
      results.assigned += 1;
      results.assignments.push(result);
    } catch (err) {
      results.failed += 1;
      results.errors.push({
        oldLeadId,
        message: err.message || 'Assignment failed',
      });
    }
  }

  if (!results.assigned) {
    const err = new Error(results.errors[0]?.message || 'No old leads were assigned');
    err.status = 400;
    err.details = results.errors;
    throw err;
  }

  return results;
}

export async function getOldLeadById(id) {
  const oldLead = await OldLead.findById(id)
    .populate('assignment.recruiterId', 'name')
    .populate('assignment.assignedBy', 'name')
    .populate('assignment.leadId', '_id');

  if (!oldLead) {
    const err = new Error('Old lead not found');
    err.status = 404;
    throw err;
  }

  return formatOldLead(oldLead);
}
