import { LeadStatus } from '../models/LeadStatus.js';
import { LEAD_STATUSES as DEFAULT_STATUSES } from '../config/recruitingConstants.js';

export async function ensureDefaultLeadStatuses() {
  for (const name of DEFAULT_STATUSES) {
    await LeadStatus.updateOne(
      { name },
      { $setOnInsert: { name, isDefault: true }, $set: { isDefault: true } },
      { upsert: true }
    );
  }
}

export async function listLeadStatuses() {
  await ensureDefaultLeadStatuses();
  const statuses = await LeadStatus.find().sort({ name: 1 }).select('name isDefault createdAt');
  return statuses;
}

export async function getLeadStatusNames() {
  const statuses = await listLeadStatuses();
  return statuses.map((status) => status.name);
}

export async function assertValidLeadStatus(status) {
  const names = await getLeadStatusNames();
  if (!names.includes(status)) {
    const err = new Error(`Invalid status: ${status}`);
    err.status = 400;
    throw err;
  }
}

export async function addLeadStatus(name, userId) {
  await ensureDefaultLeadStatuses();

  const trimmed = String(name || '').trim();
  if (!trimmed) {
    const err = new Error('Status name is required');
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
    createdBy: userId,
  });

  return status;
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
