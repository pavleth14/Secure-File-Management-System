import { MaintenanceCaseTag } from '../models/MaintenanceCaseTag.js';
import {
  MAINTENANCE_TAG_TYPES,
  MAINTENANCE_DEFAULT_PROJECTS,
} from '../config/maintenanceConstants.js';
import {
  canonicalCaseStatusName,
  dedupeCaseStatusTagRecords,
} from '../utils/maintenanceCaseStatusUtils.js';

const CASE_STATUS_TYPE = 'case_status';

function normalizeTagName(name) {
  return String(name || '').trim();
}

export function assertValidTagType(type) {
  if (!MAINTENANCE_TAG_TYPES.includes(type)) {
    const err = new Error('Invalid maintenance tag type');
    err.status = 400;
    throw err;
  }
}

export async function listMaintenanceTags(type) {
  assertValidTagType(type);
  let records = await MaintenanceCaseTag.find({ type, isActive: true }).sort({ name: 1 });
  if (type === CASE_STATUS_TYPE) {
    records = dedupeCaseStatusTagRecords(records);
    return records;
  }
  if (type !== 'project') return records;

  const byName = new Map(records.map((tag) => [tag.name, tag]));
  for (const name of MAINTENANCE_DEFAULT_PROJECTS) {
    if (!byName.has(name)) {
      byName.set(name, {
        _id: `default:${name}`,
        type: 'project',
        name,
        color: '#94A3B8',
        isActive: true,
      });
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function ensureMaintenanceTag(type, name, userId, color) {
  assertValidTagType(type);
  const normalized = normalizeTagName(name);
  if (!normalized) {
    const err = new Error('Tag name is required');
    err.status = 400;
    throw err;
  }

  const displayName = type === CASE_STATUS_TYPE ? canonicalCaseStatusName(normalized) : normalized;

  let tag = await findTagCaseInsensitive(type, displayName);
  if (tag) {
    if (!tag.isActive) {
      tag.isActive = true;
      await tag.save();
    }
    return tag;
  }

  tag = await MaintenanceCaseTag.create({
    type,
    name: displayName,
    color: color || '#94A3B8',
    isActive: true,
    createdBy: userId,
  });
  return tag;
}

async function findTagCaseInsensitive(type, name) {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;
  const records = await MaintenanceCaseTag.find({ type, isActive: true });
  return records.find((entry) => entry.name.toLowerCase() === normalized.toLowerCase()) || null;
}

export async function getTagColorMap() {
  const tags = await MaintenanceCaseTag.find({ isActive: true }).select('type name color');
  const map = new Map();
  for (const tag of tags) {
    map.set(`${tag.type}:${tag.name}`, tag.color);
  }
  return map;
}

export function formatTagRecord(tag) {
  return {
    id: tag._id.toString(),
    type: tag.type,
    name: tag.name,
    color: tag.color,
    isActive: tag.isActive,
  };
}
