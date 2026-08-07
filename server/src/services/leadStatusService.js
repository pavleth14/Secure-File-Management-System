import { Lead } from '../models/Lead.js';
import { OldLead } from '../models/OldLead.js';
import { LeadStatus } from '../models/LeadStatus.js';
import {
  LEAD_STATUSES as DEFAULT_STATUSES,
  REMOVED_LEAD_STATUSES,
  DEFAULT_SYSTEM_STATUS_ACTIVITY,
  DEFAULT_SYSTEM_STATUS_COLORS,
  DEFAULT_STATUS_COLOR,
} from '../config/recruitingConstants.js';

function formatStatusRecord(status) {
  return {
    id: status._id,
    name: status.name,
    isDefault: status.isDefault,
    isActive: Boolean(status.isActive),
    color: status.color || DEFAULT_STATUS_COLOR,
    createdAt: status.createdAt,
  };
}

export async function ensureDefaultLeadStatuses() {
  for (const name of DEFAULT_STATUSES) {
    const isActive = DEFAULT_SYSTEM_STATUS_ACTIVITY[name];
    const color = DEFAULT_SYSTEM_STATUS_COLORS[name] || DEFAULT_STATUS_COLOR;

    await LeadStatus.updateOne(
      { name },
      { $setOnInsert: { name, isDefault: true, isActive, color } },
      { upsert: true }
    );

    await LeadStatus.updateOne(
      { name, isActive: { $exists: false } },
      { $set: { isDefault: true, isActive } }
    );

    await LeadStatus.updateOne(
      { name, color: { $exists: false } },
      { $set: { color } }
    );
  }

  await LeadStatus.updateMany(
    { color: { $exists: false } },
    { $set: { color: DEFAULT_STATUS_COLOR } }
  );

  await LeadStatus.deleteMany({ name: { $in: REMOVED_LEAD_STATUSES } });
}

export async function listLeadStatuses() {
  await ensureDefaultLeadStatuses();
  const statuses = await LeadStatus.find()
    .sort({ name: 1 })
    .select('name isDefault isActive color createdAt');
  return statuses;
}

export async function getLeadStatusNames() {
  const statuses = await listLeadStatuses();
  return statuses.map((status) => status.name);
}

export async function getActiveLeadStatusNames() {
  const statuses = await listLeadStatuses();
  return statuses.filter((status) => status.isActive).map((status) => status.name);
}

export async function getInactiveLeadStatusNames() {
  const statuses = await listLeadStatuses();
  return statuses.filter((status) => !status.isActive).map((status) => status.name);
}

export async function assertValidLeadStatus(status) {
  const names = await getLeadStatusNames();
  if (!names.includes(status)) {
    const err = new Error(`Invalid status: ${status}`);
    err.status = 400;
    throw err;
  }
}

function parseIsActive(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}

function parseStatusColor(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    const err = new Error('color must be a hex value like #RRGGBB');
    err.status = 400;
    throw err;
  }
  return trimmed.toUpperCase();
}

export async function addLeadStatus(name, userId, isActive, color) {
  await ensureDefaultLeadStatuses();

  const trimmed = String(name || '').trim();
  if (!trimmed) {
    const err = new Error('Status name is required');
    err.status = 400;
    throw err;
  }

  const parsedIsActive = parseIsActive(isActive);
  if (parsedIsActive === null) {
    const err = new Error('isActive is required (true for Active, false for Non-active)');
    err.status = 400;
    throw err;
  }

  let parsedColor = DEFAULT_STATUS_COLOR;
  if (color !== undefined) {
    parsedColor = parseStatusColor(color);
    if (parsedColor === undefined) {
      const err = new Error('color must be a hex value like #RRGGBB');
      err.status = 400;
      throw err;
    }
  }

  const exists = await LeadStatus.findOne({ name: trimmed });
  if (exists) {
    const err = new Error('Status already exists');
    err.status = 409;
    throw err;
  }

  const status = await LeadStatus.create({
    name: trimmed,
    isDefault: false,
    isActive: parsedIsActive,
    color: parsedColor,
    createdBy: userId,
  });

  return status;
}

export async function updateLeadStatus(statusId, { isActive, color }) {
  await ensureDefaultLeadStatuses();

  const status = await LeadStatus.findById(statusId);
  if (!status) {
    const err = new Error('Status not found');
    err.status = 404;
    throw err;
  }

  const hasIsActive = isActive !== undefined;
  const hasColor = color !== undefined;

  if (!hasIsActive && !hasColor) {
    const err = new Error('At least one of isActive or color is required');
    err.status = 400;
    throw err;
  }

  const previousIsActive = status.isActive;
  const previousColor = status.color || DEFAULT_STATUS_COLOR;
  const oldValues = {};
  const newValues = {};

  if (hasIsActive) {
    const parsedIsActive = parseIsActive(isActive);
    if (parsedIsActive === null) {
      const err = new Error('isActive must be true or false');
      err.status = 400;
      throw err;
    }
    if (parsedIsActive !== previousIsActive) {
      oldValues.isActive = previousIsActive;
      newValues.isActive = parsedIsActive;
      status.isActive = parsedIsActive;
    }
  }

  if (hasColor) {
    const parsedColor = parseStatusColor(color);
    if (parsedColor === undefined) {
      const err = new Error('color must be a hex value like #RRGGBB');
      err.status = 400;
      throw err;
    }
    if (parsedColor !== previousColor) {
      oldValues.color = previousColor;
      newValues.color = parsedColor;
      status.color = parsedColor;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { status, previousIsActive, previousColor, changed: false };
  }

  await status.save();
  return { status, previousIsActive, previousColor, changed: true, oldValues, newValues };
}

export async function deleteLeadStatus(statusId) {
  await ensureDefaultLeadStatuses();

  const status = await LeadStatus.findById(statusId);
  if (!status) {
    const err = new Error('Status not found');
    err.status = 404;
    throw err;
  }

  if (status.isDefault || DEFAULT_STATUSES.includes(status.name)) {
    const err = new Error('System statuses cannot be deleted');
    err.status = 403;
    throw err;
  }

  await LeadStatus.deleteOne({ _id: status._id });
  return status;
}

function pickRandomStatus(names) {
  return names[Math.floor(Math.random() * names.length)];
}

export async function migrateObsoleteLeadStatuses() {
  await ensureDefaultLeadStatuses();

  const validNames = await getLeadStatusNames();
  if (!validNames.length) return { migratedLeads: 0, migratedOldLeads: 0 };

  const invalidFilter = {
    $or: [
      { status: { $in: REMOVED_LEAD_STATUSES } },
      { status: { $nin: validNames } },
    ],
  };

  const [invalidLeads, invalidOldLeads] = await Promise.all([
    Lead.find(invalidFilter).select('_id status'),
    OldLead.find(invalidFilter).select('_id status'),
  ]);

  for (const lead of invalidLeads) {
    lead.status = pickRandomStatus(validNames);
    await lead.save();
  }

  for (const oldLead of invalidOldLeads) {
    oldLead.status = pickRandomStatus(validNames);
    await oldLead.save();
  }

  return {
    migratedLeads: invalidLeads.length,
    migratedOldLeads: invalidOldLeads.length,
  };
}

export { formatStatusRecord };
