import mongoose from 'mongoose';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import {
  getActiveLeadStatusNames,
  getInactiveLeadStatusNames,
} from './leadStatusService.js';
import {
  countOtherRecruitersForRoundRobin,
  getRoundRobinAssignmentExcluding,
} from './roundRobinService.js';
import { appendReassignmentComment } from './leadReassignmentService.js';
import { DRIVER_TYPES } from '../config/recruitingConstants.js';

function normalizeExcludeIds(excludeIds) {
  return excludeIds
    .filter(Boolean)
    .map((id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)));
}

function classifyBoardLeads(leads, activeSet, inactiveSet) {
  const toReassign = [];
  const toArchive = [];
  const unknownStatus = [];

  for (const lead of leads) {
    const status = lead.status || '';
    if (inactiveSet.has(status)) {
      toArchive.push(lead);
    } else if (activeSet.has(status)) {
      toReassign.push(lead);
    } else {
      unknownStatus.push(lead);
      toReassign.push(lead);
    }
  }

  return { toReassign, toArchive, unknownStatus };
}

export async function previewRecruiterDeleteLeadMigration(recruiterId) {
  const recruiter = await User.findById(recruiterId).select('name isRecruiter');
  if (!recruiter) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (!recruiter.isRecruiter) {
    return {
      isRecruiter: false,
      boardLeadCount: 0,
      activeStatusBoardCount: 0,
      nonActiveStatusBoardCount: 0,
      appliesLeadMigration: false,
      canDelete: true,
      blockReason: null,
    };
  }

  const [activeStatusNames, inactiveStatusNames] = await Promise.all([
    getActiveLeadStatusNames(),
    getInactiveLeadStatusNames(),
  ]);
  const activeSet = new Set(activeStatusNames);
  const inactiveSet = new Set(inactiveStatusNames);

  const leads = await Lead.find({
    assignedRecruiter: recruiterId,
    archived: false,
  })
    .select('status driverType')
    .lean();

  const { toReassign, toArchive, unknownStatus } = classifyBoardLeads(
    leads,
    activeSet,
    inactiveSet
  );

  const excludeIds = normalizeExcludeIds([recruiterId]);
  const otherRecruiterCount = await countOtherRecruitersForRoundRobin(excludeIds);

  let canDelete = true;
  let blockReason = null;

  if (toReassign.length > 0 && otherRecruiterCount === 0) {
    canDelete = false;
    blockReason =
      'Cannot delete this recruiter: active-status leads need at least one other recruiter for round robin.';
  }

  return {
    isRecruiter: true,
    boardLeadCount: leads.length,
    activeStatusBoardCount: toReassign.length,
    nonActiveStatusBoardCount: toArchive.length,
    unknownStatusCount: unknownStatus.length,
    appliesLeadMigration: leads.length > 0,
    canDelete,
    blockReason,
    activeStatusNames,
    inactiveStatusNames,
  };
}

export async function migrateLeadsForDeletedRecruiter(deletedUserId, actorUser, deletedUserName) {
  const recruiter = await User.findById(deletedUserId).select('isRecruiter name');
  if (!recruiter?.isRecruiter) {
    return {
      reassignedActiveCount: 0,
      archivedNonActiveCount: 0,
      failures: [],
    };
  }

  const preview = await previewRecruiterDeleteLeadMigration(deletedUserId);
  if (!preview.canDelete) {
    const err = new Error(preview.blockReason || 'Cannot migrate leads for this recruiter');
    err.status = 400;
    throw err;
  }

  const [activeStatusNames, inactiveStatusNames] = await Promise.all([
    getActiveLeadStatusNames(),
    getInactiveLeadStatusNames(),
  ]);
  const activeSet = new Set(activeStatusNames);
  const inactiveSet = new Set(inactiveStatusNames);

  const leadDocs = await Lead.find({
    assignedRecruiter: deletedUserId,
    archived: false,
  });

  const { toReassign, toArchive } = classifyBoardLeads(leadDocs, activeSet, inactiveSet);

  const timestamp = new Date();
  const archiveComment = `Auto-archived (Non-active status) because recruiter ${deletedUserName} was deleted.`;
  const excludeIds = normalizeExcludeIds([deletedUserId]);
  const failures = [];
  let archivedNonActiveCount = 0;
  let reassignedActiveCount = 0;

  for (const lead of toArchive) {
    try {
      lead.archived = true;
      lead.archivedAt = timestamp;
      lead.archivedBy = actorUser._id;
      lead.comments.push({
        text: archiveComment,
        author: actorUser._id,
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await lead.save();
      archivedNonActiveCount += 1;
    } catch (err) {
      failures.push({ leadId: lead._id.toString(), step: 'archive', message: err.message });
    }
  }

  const recruiterNameCache = new Map();

  async function resolveRecruiterName(recruiterId) {
    const key = recruiterId.toString();
    if (recruiterNameCache.has(key)) return recruiterNameCache.get(key);
    const doc = await User.findById(recruiterId).select('name');
    const name = doc?.name || 'Unknown';
    recruiterNameCache.set(key, name);
    return name;
  }

  for (const lead of toReassign) {
    try {
      const driverType = DRIVER_TYPES.includes(lead.driverType) ? lead.driverType : 'Solo';
      const newRecruiterId = await getRoundRobinAssignmentExcluding(driverType, excludeIds);
      const newRecruiterName = await resolveRecruiterName(newRecruiterId);

      appendReassignmentComment(lead, {
        userId: actorUser._id,
        oldRecruiterName: deletedUserName,
        newRecruiterName,
        sourceLabel: `${deletedUserName} recruiter deletion (round robin)`,
      });

      lead.comments.push({
        text: `Round robin reassignment because recruiter ${deletedUserName} was deleted.`,
        author: actorUser._id,
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      lead.assignedRecruiter = newRecruiterId;
      await lead.save();
      reassignedActiveCount += 1;
    } catch (err) {
      failures.push({ leadId: lead._id.toString(), step: 'reassign', message: err.message });
    }
  }

  if (failures.length > 0) {
    const err = new Error(
      `Lead migration incomplete (${failures.length} failed). User was not deleted.`
    );
    err.status = 409;
    err.failures = failures;
    err.partialMigration = {
      reassignedActiveCount,
      archivedNonActiveCount,
    };
    throw err;
  }

  return {
    reassignedActiveCount,
    archivedNonActiveCount,
    failures: [],
  };
}
