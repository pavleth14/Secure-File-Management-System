import { MaintenanceCase } from '../models/MaintenanceCase.js';
import { MaintenanceCaseTag } from '../models/MaintenanceCaseTag.js';
import { ensureMaintenanceTag } from './maintenanceTagService.js';
import {
  canonicalCaseStatusName,
  pickPreferredCaseStatusTag,
} from '../utils/maintenanceCaseStatusUtils.js';

const CASE_STATUS_TYPE = 'case_status';

export { canonicalCaseStatusName };

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function caseStatusRegex(name) {
  return new RegExp(`^${escapeRegex(String(name || '').trim())}$`, 'i');
}

export async function countCasesWithCaseStatus(statusName) {
  const trimmed = String(statusName || '').trim();
  if (!trimmed) return 0;
  return MaintenanceCase.countDocuments({ caseStatus: caseStatusRegex(trimmed) });
}

/** Merge duplicate case_status tags and normalize case.caseStatus values. */
export async function dedupeMaintenanceCaseStatusTags() {
  const tags = await MaintenanceCaseTag.find({ type: CASE_STATUS_TYPE, isActive: true });
  const groups = new Map();
  for (const tag of tags) {
    const key = tag.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tag);
  }

  let tagsDeactivated = 0;
  let casesUpdated = 0;

  for (const group of groups.values()) {
    const { keeper, canonicalName } = pickPreferredCaseStatusTag(group);
    if (!keeper) continue;

    if (keeper.name !== canonicalName) {
      keeper.name = canonicalName;
      await keeper.save();
    }

    const duplicateIds = group.filter((t) => t._id.toString() !== keeper._id.toString());
    for (const dup of duplicateIds) {
      dup.isActive = false;
      await dup.save();
      tagsDeactivated += 1;
    }

    const updateResult = await MaintenanceCase.updateMany(
      { caseStatus: caseStatusRegex(canonicalName) },
      { $set: { caseStatus: canonicalName } }
    );
    casesUpdated += updateResult.modifiedCount || 0;
  }

  return { tagsDeactivated, casesUpdated, groups: groups.size };
}

export async function getCaseStatusTagUsage(tagId) {
  const tag = await MaintenanceCaseTag.findById(tagId);
  if (!tag || tag.type !== CASE_STATUS_TYPE) {
    const err = new Error('Case status tag not found');
    err.status = 404;
    throw err;
  }
  const count = await countCasesWithCaseStatus(tag.name);
  return { tag, count };
}

export async function deleteCaseStatusTag(tagId, options, userId) {
  const tag = await MaintenanceCaseTag.findById(tagId);
  if (!tag || tag.type !== CASE_STATUS_TYPE || !tag.isActive) {
    const err = new Error('Case status tag not found');
    err.status = 404;
    throw err;
  }

  const count = await countCasesWithCaseStatus(tag.name);
  let replacementName = '';

  if (count > 0) {
    if (options?.newReplacement?.name) {
      const created = await ensureMaintenanceTag(
        CASE_STATUS_TYPE,
        options.newReplacement.name,
        userId,
        options.newReplacement.color
      );
      replacementName = created.name;
    } else if (options?.replacementName) {
      const candidates = await MaintenanceCaseTag.find({
        type: CASE_STATUS_TYPE,
        isActive: true,
      });
      const existing = candidates.find(
        (entry) =>
          entry.name.toLowerCase() === String(options.replacementName).trim().toLowerCase()
      );
      if (!existing) {
        const err = new Error('Replacement status does not exist');
        err.status = 400;
        throw err;
      }
      replacementName = existing.name;
    } else {
      const err = new Error('Replacement status is required when cases use this status');
      err.status = 400;
      throw err;
    }

    if (caseStatusRegex(replacementName).test(tag.name)) {
      const err = new Error('Replacement status must differ from the status being removed');
      err.status = 400;
      throw err;
    }

    await MaintenanceCase.updateMany(
      { caseStatus: caseStatusRegex(tag.name) },
      { $set: { caseStatus: replacementName } }
    );
  }

  const lowerKey = tag.name.toLowerCase();
  const related = await MaintenanceCaseTag.find({
    type: CASE_STATUS_TYPE,
    isActive: true,
  });
  for (const relatedTag of related) {
    if (relatedTag.name.toLowerCase() === lowerKey) {
      relatedTag.isActive = false;
      await relatedTag.save();
    }
  }

  return {
    deletedStatus: tag.name,
    replacementName: replacementName || null,
    casesReassigned: count,
  };
}
