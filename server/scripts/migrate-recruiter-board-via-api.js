/**
 * Migrate a recruiter board via production/staging HTTP API (no direct Mongo required).
 *
 *   node scripts/migrate-recruiter-board-via-api.js --dry-run
 *   node scripts/migrate-recruiter-board-via-api.js --execute
 *
 * Env: API_BASE_URL, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD (from server/.env)
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { LEAD_EXPORT_HEADERS } from '../src/services/leadExportService.js';
import { normalizeImportEmailForEdit } from '../src/utils/importPlaceholderEmail.js';

dotenv.config();

const dryRun = !process.argv.includes('--execute');
const apiBase = (process.env.API_BASE_URL || 'https://api.twobrothersfreight.com/api').replace(
  /\/$/,
  ''
);
const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;

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

function leadApiToExportRow(lead) {
  const sorted = [...(lead.comments || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const commentColumns = {};
  for (let i = 0; i < 10; i += 1) {
    const header = i === 0 ? 'Comments' : `Comment ${i + 1}`;
    commentColumns[header] = sorted[i]?.text || '';
  }

  return {
    Status: lead.status || '',
    'Type of Driver': lead.driverType || '',
    Source: lead.source || '',
    Date: lead.date || '',
    'First Name': lead.firstName || '',
    'Last Name': lead.lastName || '',
    Phone: lead.phone || '',
    'State / City': lead.stateCity || '',
    Email: normalizeImportEmailForEdit(lead.email),
    ...commentColumns,
    'Assigned Recruiter': lead.assignedRecruiter?.name || '',
    'Lead ID': lead.id || '',
    'Created At': lead.createdAt ? new Date(lead.createdAt).toISOString() : '',
    'Updated At': lead.updatedAt ? new Date(lead.updatedAt).toISOString() : '',
  };
}

function rowsToCsv(rows) {
  const body = rows.map((row) =>
    LEAD_EXPORT_HEADERS.map((header) => escapeCsvValue(row[header])).join(',')
  );
  return [LEAD_EXPORT_HEADERS.join(','), ...body].join('\n');
}

async function login() {
  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env');
  }

  const response = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Login failed (${response.status}): ${body}`);
  }

  const setCookie = response.headers.getSetCookie?.() || [];
  const access = setCookie.find((c) => c.startsWith('accessToken='));
  if (!access) {
    throw new Error('No accessToken cookie returned from login');
  }

  return access.split(';')[0];
}

async function apiGet(cookie, pathname, searchParams = {}) {
  const url = new URL(`${apiBase}${pathname}`);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, { headers: { Cookie: cookie } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `GET ${pathname} failed (${response.status})`);
  }
  return data;
}

async function apiPost(cookie, pathname, body = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `POST ${pathname} failed (${response.status})`);
  }
  return data;
}

function findBoardUserId(boards, name) {
  const normalized = name.trim().toLowerCase();
  const exact = boards.find((board) => board.label.toLowerCase().replace(/\s+board$/, '') === normalized);
  if (exact) return exact.userId;

  const partial = boards.find((board) => board.label.toLowerCase().includes(normalized));
  if (partial) return partial.userId;

  return null;
}

function buildRoundRobinPicker(recruiters, excludeIds) {
  const exclude = new Set(excludeIds.map(String));
  const byDriverType = new Map();
  const allPool = [];

  for (const recruiter of recruiters) {
    if (exclude.has(String(recruiter.id))) continue;
    allPool.push(recruiter);
    for (const driverType of recruiter.roundRobinDriverTypes || []) {
      if (!byDriverType.has(driverType)) byDriverType.set(driverType, []);
      byDriverType.get(driverType).push(recruiter);
    }
  }

  for (const list of byDriverType.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  allPool.sort((a, b) => a.name.localeCompare(b.name));

  const indices = new Map();

  return function pick(driverType) {
    let pool = byDriverType.get(driverType) || [];
    let key = driverType;
    if (!pool.length) {
      pool = allPool;
      key = `${driverType}::fallback`;
    }
    if (!pool.length) {
      throw new Error(`No recruiters in round robin pool for ${driverType}`);
    }

    const current = indices.get(key) ?? -1;
    const next = (current + 1) % pool.length;
    indices.set(key, next);
    return pool[next];
  };
}

async function fetchAllActiveBoardLeads(cookie, recruiterId) {
  const leads = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await apiGet(cookie, '/recruiting/leads', {
      recruiterId,
      limit: 100,
      page,
      sortBy: 'createdAt',
      sortDir: 'asc',
    });
    leads.push(...data.leads);
    totalPages = data.totalPages || 1;
    page += 1;
  }

  return leads;
}

async function main() {
  const cookie = await login();
  const { boards } = await apiGet(cookie, '/recruiting/boards');
  const fromId = findBoardUserId(boards, fromRecruiterName);
  if (!fromId) {
    throw new Error(`Source recruiter board not found: ${fromRecruiterName}`);
  }

  const excludeIds = [fromId];
  for (const name of excludeRecruiterNames) {
    const id = findBoardUserId(boards, name);
    if (id) excludeIds.push(id);
    else console.warn(`[warn] exclude board not found: ${name}`);
  }

  const { statuses } = await apiGet(cookie, '/recruiting/statuses');
  const activeStatuses = new Set(statuses.filter((s) => s.isActive).map((s) => s.name));
  const inactiveStatuses = new Set(statuses.filter((s) => !s.isActive).map((s) => s.name));

  const rrSettings = await apiGet(cookie, '/recruiting/round-robin/settings');
  const pickRecruiter = buildRoundRobinPicker(rrSettings.recruiters, excludeIds);

  const allLeads = await fetchAllActiveBoardLeads(cookie, fromId);
  const toReassign = allLeads.filter((lead) => activeStatuses.has(lead.status));
  const toArchive = allLeads.filter((lead) => inactiveStatuses.has(lead.status));
  const unknown = allLeads.filter(
    (lead) => !activeStatuses.has(lead.status) && !inactiveStatuses.has(lead.status)
  );

  const exportRows = toReassign.map(leadApiToExportRow);
  const datePart = new Date().toISOString().slice(0, 10);
  const slug = fromRecruiterName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const exportPath = path.join(outputDir, `${slug}-active-board-leads-backup-${datePart}.csv`);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(exportPath, `\uFEFF${rowsToCsv(exportRows)}`, 'utf8');

  const summary = {
    dryRun,
    apiBase,
    fromRecruiter: fromRecruiterName,
    fromRecruiterId: fromId,
    excludeFromRoundRobin: excludeRecruiterNames,
    totalBoardLeads: allLeads.length,
    activeStatusReassign: toReassign.length,
    nonActiveStatusArchive: toArchive.length,
    unknownStatus: unknown.length,
    exportPath,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (unknown.length) {
    console.warn('[warn] unknown statuses', unknown.map((l) => ({ id: l.id, status: l.status })));
  }

  if (dryRun) {
    console.log('[dry-run] CSV backup written. Re-run with --execute to archive/reassign.');
    return;
  }

  const archiveFailures = [];
  for (const lead of toArchive) {
    try {
      await apiPost(cookie, `/recruiting/leads/${lead.id}/archive`);
    } catch (err) {
      archiveFailures.push({ id: lead.id, message: err.message });
    }
  }

  const assignmentCounts = {};
  const assignFailures = [];

  for (const lead of toReassign) {
    try {
      const recruiter = pickRecruiter(lead.driverType || 'Solo');
      await apiPost(cookie, `/recruiting/leads/${lead.id}/assign`, {
        assignedRecruiterId: recruiter.id,
      });
      assignmentCounts[recruiter.name] = (assignmentCounts[recruiter.name] || 0) + 1;
    } catch (err) {
      assignFailures.push({ id: lead.id, message: err.message });
    }
  }

  console.log('[done] assignmentCounts', assignmentCounts);
  if (archiveFailures.length) console.error('[done] archiveFailures', archiveFailures);
  if (assignFailures.length) console.error('[done] assignFailures', assignFailures);
  console.log(`[done] CSV backup: ${exportPath}`);
}

main().catch((err) => {
  console.error('[migrate-recruiter-board-via-api] failed', err);
  process.exit(1);
});
