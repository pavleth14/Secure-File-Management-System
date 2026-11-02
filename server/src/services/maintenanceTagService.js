import { MaintenanceCaseTag } from '../models/MaintenanceCaseTag.js';
import {
  MAINTENANCE_TAG_TYPES,
  MAINTENANCE_DEFAULT_PROJECTS,
} from '../config/maintenanceConstants.js';
import {
  dedupeCaseStatusTagRecords,
  resolveCaseStatusStorageName,
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

async function consolidateCaseStatusTag(storageName, userId, color) {
  const lower = storageName.toLowerCase();
  const group = (await MaintenanceCaseTag.find({ type: CASE_STATUS_TYPE })).filter(
    (tag) => tag.name.toLowerCase() === lower
  );

  if (!group.length) {
    return MaintenanceCaseTag.create({
      type: CASE_STATUS_TYPE,
      name: storageName,
      color: color || '#94A3B8',
      isActive: true,
      createdBy: userId,
    });
  }

  let keeper =
    group.find((tag) => tag.name === storageName) ||
    group.find((tag) => tag.isActive) ||
    group[0];

  for (const other of group) {
    if (other._id.toString() === keeper._id.toString()) continue;
    await MaintenanceCaseTag.deleteOne({ _id: other._id });
  }

  keeper.isActive = true;
  if (color) keeper.color = color;
  if (keeper.name !== storageName) {
    keeper.name = storageName;
  }
  await keeper.save();
  return keeper;
}

export async function ensureMaintenanceTag(type, name, userId, color) {
  assertValidTagType(type);
  const normalized = normalizeTagName(name);
  if (!normalized) {
    const err = new Error('Tag name is required');
    err.status = 400;
    throw err;
  }

  const storageName =
    type === CASE_STATUS_TYPE ? resolveCaseStatusStorageName(normalized) : normalized;

  if (type === CASE_STATUS_TYPE) {
    return consolidateCaseStatusTag(storageName, userId, color);
  }

  const exact = await MaintenanceCaseTag.findOne({ type, name: storageName });
  if (exact) {
    exact.isActive = true;
    if (color) exact.color = color;
    await exact.save();
    return exact;
  }

  return MaintenanceCaseTag.create({
    type,
    name: storageName,
    color: color || '#94A3B8',
    isActive: true,
    createdBy: userId,
  });
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
