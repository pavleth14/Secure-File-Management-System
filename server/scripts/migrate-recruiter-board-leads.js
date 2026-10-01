/**
 * One-off: split a recruiter's active board leads by status activity (Active vs Non-active tabs),
 * export Active-status leads to CSV, archive Non-active, RR-reassign Active to other recruiters.
 *
 * Usage:
 *   node scripts/migrate-recruiter-board-leads.js --dry-run
 *   node scripts/migrate-recruiter-board-leads.js --execute
 *
 * Options:
 *   --from-recruiter="Nolan Greyson"
 *   --exclude-recruiter="Jesse Jones"   (repeatable; also excludes --from-recruiter from RR pool)
 *   --output-dir="C:\Users\Administrator\Downloads"
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Lead } from '../src/models/Lead.js';
import { User } from '../src/models/User.js';
import { RecruitingState } from '../src/models/RecruitingState.js';
import { DRIVER_TYPES } from '../src/config/recruitingConstants.js';
import {
  getActiveLeadStatusNames,
  getInactiveLeadStatusNames,
} from '../src/services/leadStatusService.js';
import {
  LEAD_EXPORT_HEADERS,
  leadToExportRow,
} from '../src/services/leadExportService.js';
import { appendReassignmentComment } from '../src/services/leadReassignmentService.js';

dotenv.config();

function parseArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  if (hit) return hit.slice(prefix.length).replace(/^["']|["']$/g, '');
  return fallback;
}

function parseArgList(name) {
  return process.argv
    .filter((arg) => arg.startsWith(`--${name}=`))
    .map((arg) => arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, ''));
}

const dryRun = !process.argv.includes('--execute');
const fromRecruiterName = parseArg('from-recruiter', 'Nolan Greyson');
const excludeFromCli = parseArgList('exclude-recruiter');
const excludeRecruiterNames = (
  excludeFromCli.length ? excludeFromCli : ['Jesse Jones']
).filter((value, index, arr) => arr.indexOf(value) === index);

const outputDir =
  parseArg('output-dir', path.join(process.env.USERPROFILE || '', 'Downloads')) ||
  path.join(process.cwd(), 'exports');

function escapeCsvValue(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows) {
  const body = rows.map((row) =>
    LEAD_EXPORT_HEADERS.map((header) => escapeCsvValue(row[header])).join(',')
  );
  return [LEAD_EXPORT_HEADERS.join(','), ...body].join('\n');
}

function roundRobinStateKey(driverType, suffix = '') {
  const base = `round_robin_${String(driverType).replace(/\s+/g, '_')}`;
  return suffix ? `${base}_${suffix}` : base;
}

async function findRecruiterByName(name) {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const user = await User.findOne({
    name: new RegExp(`^${escaped}$`, 'i'),
    isRecruiter: true,
  }).select('_id name');
  if (user) return user;

  return User.findOne({
    name: new RegExp(escaped, 'i'),
    isRecruiter: true,
  }).select('_id name');
}

async function getEligibleRecruiters(driverType, excludeIds) {
  if (!DRIVER_TYPES.includes(driverType)) {
    return [];
  }

  return User.find({
    isRecruiter: true,
    roundRobinDriverTypes: driverType,
    _id: { $nin: excludeIds },
  })
    .sort({ name: 1 })
    .select('_id name');
}

async function getFallbackRecruiters(excludeIds) {
  return User.find({
    isRecruiter: true,
    _id: { $nin: excludeIds },
  })
    .sort({ name: 1 })
    .select('_id name');
}

async function pickRoundRobinRecruiter(driverType, excludeIds) {
  let recruiters = await getEligibleRecruiters(driverType, excludeIds);
  let stateKey = roundRobinStateKey(driverType);
  let poolLabel = driverType;

  if (!recruiters.length) {
    recruiters = await getFallbackRecruiters(excludeIds);
    stateKey = roundRobinStateKey(driverType, 'fallback_all');
    poolLabel = `${driverType} (fallback all recruiters)`;
  }

  if (!recruiters.length) {
    const err = new Error(`No recruiters available for round robin (${driverType})`);
    err.status = 400;
    throw err;
  }

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

  return { recruiter: recruiters[index], poolLabel };
}

async function resolveActorUser() {
  const admin =
    (await User.findOne({ role: 'SUPER_ADMIN' }).select('_id name')) ||
    (await User.findOne({ isRecruitingManager: true }).select('_id name'));
  if (!admin) {
    throw new Error('No SUPER_ADMIN or recruiting manager found for system comments');
  }
  return admin;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const fromRecruiter = await findRecruiterByName(fromRecruiterName);
  if (!fromRecruiter) {
    throw new Error(`Source recruiter not found: ${fromRecruiterName}`);
  }

  const excludeRecruiters = [];
  for (const name of excludeRecruiterNames) {
    const user = await findRecruiterByName(name);
    if (user) excludeRecruiters.push(user);
    else console.warn(`[warn] exclude recruiter not found (skipped): ${name}`);
  }

  const excludeIds = [
    fromRecruiter._id,
    ...excludeRecruiters.map((user) => user._id),
  ];

  const [activeStatusNames, inactiveStatusNames] = await Promise.all([
    getActiveLeadStatusNames(),
    getInactiveLeadStatusNames(),
  ]);

  const activeSet = new Set(activeStatusNames);
  const inactiveSet = new Set(inactiveStatusNames);

  const leads = await Lead.find({
    assignedRecruiter: fromRecruiter._id,
    archived: false,
  })
    .populate('assignedRecruiter', 'name')
    .lean();

  const toArchive = [];
  const toReassign = [];
  const unknownStatus = [];

  for (const lead of leads) {
    const status = lead.status || '';
    if (inactiveSet.has(status)) {
      toArchive.push(lead);
    } else if (activeSet.has(status)) {
      toReassign.push(lead);
    } else {
      unknownStatus.push(lead);
    }
  }

  const exportLeads = toReassign;
  const exportRows = exportLeads.map(leadToExportRow);
  const csv = rowsToCsv(exportRows);
  const datePart = new Date().toISOString().slice(0, 10);
  const slug = fromRecruiter.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const exportFilename = `${slug}-active-board-leads-backup-${datePart}.csv`;
  const exportPath = path.join(outputDir, exportFilename);

  fs.mkdirSync(outputDir, { recursive: true });
  if (!dryRun) {
    fs.writeFileSync(exportPath, `\uFEFF${csv}`, 'utf8');
  }

  const summary = {
    dryRun,
    fromRecruiter: fromRecruiter.name,
    excludeFromRoundRobin: excludeRecruiters.map((user) => user.name),
    totalBoardLeads: leads.length,
    activeStatusReassign: toReassign.length,
    nonActiveStatusArchive: toArchive.length,
    unknownStatus: unknownStatus.length,
    exportPath: dryRun ? `(would write) ${exportPath}` : exportPath,
    activeStatusNames,
    inactiveStatusNames,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (unknownStatus.length) {
    console.warn(
      '[warn] Unknown statuses (not in active/inactive lists):',
      unknownStatus.map((lead) => ({ id: lead._id.toString(), status: lead.status }))
    );
  }

  if (dryRun) {
    console.log('[dry-run] No database changes. Re-run with --execute to apply.');
    await mongoose.disconnect();
    return;
  }

  const actor = await resolveActorUser();
  const timestamp = new Date();
  const archiveComment = `Auto-archived (Non-active status) during ${fromRecruiter.name} board migration.`;
  const migrationSource = `${fromRecruiter.name} board migration (round robin)`;

  for (const leadDoc of toArchive) {
    const lead = await Lead.findById(leadDoc._id);
    if (!lead || lead.archived) continue;
    lead.archived = true;
    lead.archivedAt = timestamp;
    lead.archivedBy = actor._id;
    lead.comments.push({
      text: archiveComment,
      author: actor._id,
      isSystem: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await lead.save();
  }

  const assignmentCounts = {};
  const failures = [];

  for (const leadDoc of toReassign) {
    const lead = await Lead.findById(leadDoc._id);
    if (!lead || lead.archived) continue;

    try {
      const { recruiter, poolLabel } = await pickRoundRobinRecruiter(
        lead.driverType || 'Solo',
        excludeIds
      );

      appendReassignmentComment(lead, {
        userId: actor._id,
        oldRecruiterName: fromRecruiter.name,
        newRecruiterName: recruiter.name,
        sourceLabel: migrationSource,
      });

      lead.comments.push({
        text: `Round robin reassignment (${poolLabel}).`,
        author: actor._id,
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      lead.assignedRecruiter = recruiter._id;
      await lead.save();

      const key = recruiter.name;
      assignmentCounts[key] = (assignmentCounts[key] || 0) + 1;
    } catch (err) {
      failures.push({ leadId: lead._id.toString(), message: err.message });
    }
  }

  console.log('[done] assignmentCounts', assignmentCounts);
  if (failures.length) {
    console.error('[done] failures', failures);
  }
  console.log(`[done] CSV backup: ${exportPath}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[migrate-recruiter-board-leads] failed', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
