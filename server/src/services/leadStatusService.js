import { Lead } from '../models/Lead.js';
import { OldLead } from '../models/OldLead.js';
import { LeadStatus } from '../models/LeadStatus.js';
import {
  LEAD_STATUSES as DEFAULT_STATUSES,
  REMOVED_LEAD_STATUSES,
  DEFAULT_SYSTEM_STATUS_ACTIVITY,
} from '../config/recruitingConstants.js';

function formatStatusRecord(status) {
  return {
    id: status._id,
    name: status.name,
    isDefault: status.isDefault,
    isActive: Boolean(status.isActive),
    createdAt: status.createdAt,
  };
}

export async function ensureDefaultLeadStatuses() {
  for (const name of DEFAULT_STATUSES) {
    const isActive = DEFAULT_SYSTEM_STATUS_ACTIVITY[name];

    await LeadStatus.updateOne(
      { name },
      { $setOnInsert: { name, isDefault: true, isActive } },
      { upsert: true }
    );

    await LeadStatus.updateOne(
      { name, isActive: { $exists: false } },
      { $set: { isDefault: true, isActive } }
    );
  }

  await LeadStatus.deleteMany({ name: { $in: REMOVED_LEAD_STATUSES } });
}

export async function listLeadStatuses() {
  await ensureDefaultLeadStatuses();
  const statuses = await LeadStatus.find()
    .sort({ name: 1 })
    .select('name isDefault isActive createdAt');
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

export async function addLeadStatus(name, userId, isActive) {
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
    createdBy: userId,
  });

  return status;
}

export async function updateLeadStatus(statusId, { isActive }) {
  await ensureDefaultLeadStatuses();

  const status = await LeadStatus.findById(statusId);
  if (!status) {
    const err = new Error('Status not found');
    err.status = 404;
    throw err;
  }

  const parsedIsActive = parseIsActive(isActive);
  if (parsedIsActive === null) {
    const err = new Error('isActive is required (true for Active, false for Non-active)');
    err.status = 400;
    throw err;
  }

  const previousIsActive = status.isActive;
  status.isActive = parsedIsActive;
  await status.save();
  return { status, previousIsActive };
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
