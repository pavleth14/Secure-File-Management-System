import { MaintenanceCaseTag } from '../models/MaintenanceCaseTag.js';
import { MAINTENANCE_TAG_TYPES } from '../config/maintenanceConstants.js';

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
  return MaintenanceCaseTag.find({ type, isActive: true }).sort({ name: 1 });
}

export async function ensureMaintenanceTag(type, name, userId, color) {
  assertValidTagType(type);
  const normalized = normalizeTagName(name);
  if (!normalized) {
    const err = new Error('Tag name is required');
    err.status = 400;
    throw err;
  }

  let tag = await MaintenanceCaseTag.findOne({ type, name: normalized });
  if (tag) {
    if (!tag.isActive) {
      tag.isActive = true;
      await tag.save();
    }
    return tag;
  }

  tag = await MaintenanceCaseTag.create({
    type,
    name: normalized,
    color: color || '#94A3B8',
    isActive: true,
    createdBy: userId,
  });
  return tag;
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
