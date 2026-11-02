import { MaintenanceCase } from '../models/MaintenanceCase.js';
import { MaintenanceCaseTag } from '../models/MaintenanceCaseTag.js';
import { assertValidTagType } from './maintenanceTagService.js';
import { ensureMaintenanceTag } from './maintenanceTagService.js';
import { deleteCaseStatusTag } from './maintenanceCaseStatusTagService.js';

const CASE_STATUS_TYPE = 'case_status';

const TAG_TYPE_TO_CASE_FIELD = Object.freeze({
  case_status: 'caseStatus',
  project: 'project',
  case_type: 'caseType',
  invoice_status: 'invoiceStatus',
  dispatch_status: 'dispatchStatus',
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fieldValueRegex(name) {
  return new RegExp(`^${escapeRegex(String(name || '').trim())}$`, 'i');
}

function namesEquivalent(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function caseFieldForTagType(type) {
  const field = TAG_TYPE_TO_CASE_FIELD[type];
  if (!field) {
    const err = new Error('Unsupported maintenance tag type');
    err.status = 400;
    throw err;
  }
  return field;
}

export async function countCasesUsingTagValue(type, tagName) {
  const field = caseFieldForTagType(type);
  const trimmed = String(tagName || '').trim();
  if (!trimmed) return 0;
  return MaintenanceCase.countDocuments({ [field]: fieldValueRegex(trimmed) });
}

export async function getMaintenanceTagUsage(tagId) {
  const tag = await MaintenanceCaseTag.findById(tagId);
  if (!tag || !tag.isActive) {
    const err = new Error('Maintenance tag not found');
    err.status = 404;
    throw err;
  }
  assertValidTagType(tag.type);
  const count = await countCasesUsingTagValue(tag.type, tag.name);
  return { tag, count };
}

export async function deleteMaintenanceTagById(tagId, options, userId) {
  const tag = await MaintenanceCaseTag.findById(tagId);
  if (!tag || !tag.isActive) {
    const err = new Error('Maintenance tag not found');
    err.status = 404;
    throw err;
  }
  assertValidTagType(tag.type);

  if (tag.type === CASE_STATUS_TYPE) {
    return deleteCaseStatusTag(tagId, options, userId);
  }

  const field = caseFieldForTagType(tag.type);
  const count = await countCasesUsingTagValue(tag.type, tag.name);
  let replacementName = '';

  if (count > 0) {
    if (options?.newReplacement?.name) {
      const created = await ensureMaintenanceTag(
        tag.type,
        options.newReplacement.name,
        userId,
        options.newReplacement.color
      );
      replacementName = created.name;
    } else if (options?.replacementName) {
      const candidates = await MaintenanceCaseTag.find({ type: tag.type, isActive: true });
      const existing = candidates.find((entry) =>
        namesEquivalent(entry.name, options.replacementName)
      );
      if (!existing) {
        const err = new Error('Replacement value does not exist');
        err.status = 400;
        throw err;
      }
      replacementName = existing.name;
    } else {
      const err = new Error('Replacement is required when cases use this value');
      err.status = 400;
      throw err;
    }

    if (namesEquivalent(replacementName, tag.name)) {
      const err = new Error('Replacement must differ from the value being removed');
      err.status = 400;
      throw err;
    }

    await MaintenanceCase.updateMany(
      { [field]: fieldValueRegex(tag.name) },
      { $set: { [field]: replacementName } }
    );
  }

  const lowerKey = tag.name.toLowerCase();
  const related = await MaintenanceCaseTag.find({ type: tag.type });
  for (const relatedTag of related) {
    if (relatedTag.name.toLowerCase() === lowerKey) {
      await MaintenanceCaseTag.deleteOne({ _id: relatedTag._id });
    }
  }

  return {
    deletedName: tag.name,
    replacementName: replacementName || null,
    casesReassigned: count,
  };
}

export async function updateMaintenanceTagById(tagId, payload, userId) {
  const tag = await MaintenanceCaseTag.findById(tagId);
  if (!tag || !tag.isActive) {
    const err = new Error('Maintenance tag not found');
    err.status = 404;
    throw err;
  }
  assertValidTagType(tag.type);

  const nextName =
    payload.name !== undefined ? String(payload.name || '').trim() : tag.name;
  const nextColor = payload.color !== undefined ? payload.color : tag.color;
  if (!nextName) {
    const err = new Error('Tag name is required');
    err.status = 400;
    throw err;
  }

  const siblings = await MaintenanceCaseTag.find({
    type: tag.type,
    isActive: true,
    _id: { $ne: tag._id },
  });
  if (siblings.some((entry) => namesEquivalent(entry.name, nextName))) {
    const err = new Error('A tag with this name already exists');
    err.status = 400;
    throw err;
  }

  const field = caseFieldForTagType(tag.type);
  const oldName = tag.name;
  if (!namesEquivalent(oldName, nextName)) {
    await MaintenanceCase.updateMany(
      { [field]: fieldValueRegex(oldName) },
      { $set: { [field]: nextName } }
    );
  }

  tag.name = nextName;
  tag.color = nextColor || tag.color;
  await tag.save();

  return tag;
}
