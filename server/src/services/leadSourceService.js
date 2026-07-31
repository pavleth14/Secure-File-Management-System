import { LeadSource } from '../models/LeadSource.js';
import { LEAD_SOURCES as DEFAULT_SOURCES } from '../config/recruitingConstants.js';

export async function ensureDefaultLeadSources() {
  for (const name of DEFAULT_SOURCES) {
    await LeadSource.updateOne(
      { name },
      { $setOnInsert: { name, isDefault: true }, $set: { isDefault: true } },
      { upsert: true }
    );
  }
}

export async function listLeadSources() {
  await ensureDefaultLeadSources();
  const sources = await LeadSource.find().sort({ name: 1 }).select('name isDefault createdAt');
  return sources;
}

export async function getLeadSourceNames() {
  const sources = await listLeadSources();
  return sources.map((source) => source.name);
}

export async function assertValidLeadSource(source) {
  const names = await getLeadSourceNames();
  if (!names.includes(source)) {
    const err = new Error(`Invalid source: ${source}`);
    err.status = 400;
    throw err;
  }
}

export async function addLeadSource(name, userId) {
  await ensureDefaultLeadSources();

  const trimmed = String(name || '').trim();
  if (!trimmed) {
    const err = new Error('Source name is required');
    err.status = 400;
    throw err;
  }

  const exists = await LeadSource.findOne({ name: trimmed });
  if (exists) {
    const err = new Error('Source already exists');
    err.status = 409;
    throw err;
  }

  const source = await LeadSource.create({
    name: trimmed,
    isDefault: false,
    createdBy: userId,
  });

  return source;
}

export async function deleteLeadSource(sourceId) {
  await ensureDefaultLeadSources();

  const source = await LeadSource.findById(sourceId);
  if (!source) {
    const err = new Error('Source not found');
    err.status = 404;
    throw err;
  }

  if (source.isDefault || DEFAULT_SOURCES.includes(source.name)) {
    const err = new Error('System lead sources cannot be deleted');
    err.status = 403;
    throw err;
  }

  await LeadSource.deleteOne({ _id: source._id });
  return source;
}
