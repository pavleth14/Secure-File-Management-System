import { User } from '../models/User.js';
import { RecruitingState } from '../models/RecruitingState.js';
import {
  DRIVER_TYPES,
  DEFAULT_OTR_ROUND_ROBIN_DRIVER_TYPES,
} from '../config/recruitingConstants.js';

function roundRobinStateKey(driverType) {
  return `round_robin_${String(driverType).replace(/\s+/g, '_')}`;
}

function normalizeDriverTypes(types) {
  if (!Array.isArray(types)) return [];
  return DRIVER_TYPES.filter((type) => types.includes(type));
}

export async function ensureRoundRobinDefaults() {
  const result = await User.updateMany(
    { isRecruiter: true, roundRobinDriverTypes: { $exists: false } },
    { $set: { roundRobinDriverTypes: DEFAULT_OTR_ROUND_ROBIN_DRIVER_TYPES } }
  );

  return { modifiedCount: result.modifiedCount ?? result.nModified ?? 0 };
}

export async function listRoundRobinSettings() {
  const recruiters = await User.find({ isRecruiter: true })
    .sort({ name: 1 })
    .select('name roundRobinDriverTypes');

  const coverage = Object.fromEntries(DRIVER_TYPES.map((type) => [type, 0]));
  for (const recruiter of recruiters) {
    for (const driverType of recruiter.roundRobinDriverTypes || []) {
      if (coverage[driverType] !== undefined) {
        coverage[driverType] += 1;
      }
    }
  }

  return {
    driverTypes: DRIVER_TYPES,
    recruiters: recruiters.map((recruiter) => ({
      id: recruiter._id,
      name: recruiter.name,
      roundRobinDriverTypes: [...(recruiter.roundRobinDriverTypes || [])],
    })),
    coverage,
  };
}

export async function updateRoundRobinSettings(recruitersPayload) {
  if (!Array.isArray(recruitersPayload)) {
    const err = new Error('recruiters must be an array');
    err.status = 400;
    throw err;
  }

  for (const item of recruitersPayload) {
    if (!item?.id) continue;

    const roundRobinDriverTypes = normalizeDriverTypes(item.roundRobinDriverTypes);
    const updated = await User.findOneAndUpdate(
      { _id: item.id, isRecruiter: true },
      { $set: { roundRobinDriverTypes } },
      { new: true }
    );

    if (!updated) {
      const err = new Error(`Recruiter not found: ${item.id}`);
      err.status = 404;
      throw err;
    }
  }

  return listRoundRobinSettings();
}

async function getEligibleRecruiters(driverType) {
  if (!DRIVER_TYPES.includes(driverType)) {
    const err = new Error(`Invalid driver type: ${driverType}`);
    err.status = 400;
    throw err;
  }

  return User.find({
    isRecruiter: true,
    roundRobinDriverTypes: driverType,
  })
    .sort({ name: 1 })
    .select('_id name');
}

export async function getRoundRobinAssignment(driverType) {
  const recruiters = await getEligibleRecruiters(driverType);
  if (!recruiters.length) {
    const err = new Error(`No recruiters configured for round robin (${driverType})`);
    err.status = 400;
    throw err;
  }

  const stateKey = roundRobinStateKey(driverType);
  const state = await RecruitingState.findOneAndUpdate(
    { key: stateKey },
    { $setOnInsert: { key: stateKey, lastRecruiterIndex: -1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const index = ((state.lastRecruiterIndex ?? -1) + 1) % recruiters.length;
  await RecruitingState.findOneAndUpdate(
    { key: stateKey },
    { $set: { lastRecruiterIndex: index } }
  );

  return recruiters[index]._id;
}

export async function getRoundRobinAssignments(items) {
  const assignments = [];
  for (const item of items) {
    assignments.push(await getRoundRobinAssignment(item.driverType));
  }
  return assignments;
}
