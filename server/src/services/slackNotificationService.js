import { User } from '../models/User.js';

function isSlackLeadNotificationsEnabled() {
  return (
    process.env.SLACK_LEAD_NOTIFICATIONS_ENABLED === 'true' &&
    Boolean(process.env.SLACK_WEBHOOK_URL?.trim())
  );
}

function getFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || '';
  const first = raw.split(',')[0]?.trim().replace(/\/$/, '');
  return first || null;
}

function resolveRecruiterId(lead, options = {}) {
  if (options.recruiterId) return String(options.recruiterId);
  const recruiter = lead?.assignedRecruiter;
  if (!recruiter) return null;
  if (typeof recruiter === 'object' && recruiter.id) return String(recruiter.id);
  if (typeof recruiter === 'object' && recruiter._id) return String(recruiter._id);
  return String(recruiter);
}

async function resolveRecruiterName(lead, options = {}) {
  if (options.recruiterName) return options.recruiterName;

  const recruiter = lead?.assignedRecruiter;
  if (recruiter && typeof recruiter === 'object' && recruiter.name) {
    return recruiter.name;
  }

  const recruiterId = resolveRecruiterId(lead, options);
  if (!recruiterId) return 'Unknown';

  const user = await User.findById(recruiterId).select('name').lean();
  return user?.name || 'Unknown';
}

function buildSlackPayload(lead, { sourceLabel, recruiterName, boardUrl }) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
  const source = sourceLabel || lead.source || '—';

  const fields = [
    { type: 'mrkdwn', text: `*Name:*\n${fullName}` },
    { type: 'mrkdwn', text: `*Recruiter:*\n${recruiterName}` },
    { type: 'mrkdwn', text: `*Status:*\n${lead.status || 'New Lead'}` },
    { type: 'mrkdwn', text: `*Driver type:*\n${lead.driverType || '—'}` },
    { type: 'mrkdwn', text: `*Source:*\n${source}` },
    { type: 'mrkdwn', text: `*Phone:*\n${lead.phone || '—'}` },
    { type: 'mrkdwn', text: `*Email:*\n${lead.email || '—'}` },
  ];

  if (lead.stateCity) {
    fields.push({ type: 'mrkdwn', text: `*State / City:*\n${lead.stateCity}` });
  }

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'New lead received', emoji: true },
    },
    { type: 'section', fields: fields.slice(0, 8) },
  ];

  if (boardUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open recruiter board' },
          url: boardUrl,
        },
      ],
    });
  }

  return {
    text: `New lead: ${fullName} → ${recruiterName}`,
    blocks,
  };
}

async function postSlackPayload(payload) {
  if (!isSlackLeadNotificationsEnabled()) return;

  const webhookUrl = process.env.SLACK_WEBHOOK_URL.trim();
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Slack webhook failed (${response.status}): ${body || response.statusText}`);
  }
}

function getCsvImportPerLeadMax() {
  const parsed = parseInt(process.env.SLACK_CSV_IMPORT_PER_LEAD_MAX || '10', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

async function buildRecruiterNameMap(recruiterIds) {
  const uniqueIds = [...new Set(recruiterIds.filter(Boolean).map(String))];
  if (!uniqueIds.length) return new Map();

  const users = await User.find({ _id: { $in: uniqueIds } }).select('name').lean();
  return new Map(users.map((user) => [user._id.toString(), user.name]));
}

function aggregateRecruiterCounts(importedLeads, nameById) {
  const counts = new Map();

  for (const lead of importedLeads) {
    const recruiterId = String(lead.assignedRecruiter);
    if (!counts.has(recruiterId)) {
      counts.set(recruiterId, {
        recruiterId,
        name: nameById.get(recruiterId) || 'Unknown',
        count: 0,
      });
    }
    counts.get(recruiterId).count += 1;
  }

  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function sendCsvImportSummaryNotification(importedLeads, options = {}) {
  const recruiterIds = importedLeads.map((lead) => lead.assignedRecruiter);
  const nameById = await buildRecruiterNameMap(recruiterIds);
  const byRecruiter = aggregateRecruiterCounts(importedLeads, nameById);
  const total = importedLeads.length;
  const sourceLabel = options.sourceLabel || 'CSV Import';

  const lines = byRecruiter.map((row) => `• *${row.name}:* ${row.count} lead${row.count === 1 ? '' : 's'}`);
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'CSV import completed', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${total}* lead${total === 1 ? '' : 's'} imported via *${sourceLabel}*.\n\n*Assigned by recruiter:*\n${lines.join('\n')}`,
      },
    },
  ];

  await postSlackPayload({
    text: `CSV import: ${total} leads assigned (${byRecruiter.length} recruiters)`,
    blocks,
  });
}

async function sendNewLeadNotification(lead, options = {}) {
  if (!isSlackLeadNotificationsEnabled()) return;

  const recruiterName = await resolveRecruiterName(lead, options);
  const recruiterId = resolveRecruiterId(lead, options);
  const baseUrl = getFrontendBaseUrl();
  const boardUrl = baseUrl && recruiterId ? `${baseUrl}/recruiting/boards/${recruiterId}` : null;

  const payload = buildSlackPayload(lead, {
    sourceLabel: options.sourceLabel,
    recruiterName,
    boardUrl,
  });

  await postSlackPayload(payload);
}

async function sendCsvImportNotifications(importedLeads, options = {}) {
  if (!importedLeads.length) return;

  const maxPerLead = getCsvImportPerLeadMax();
  const sourceLabel = options.sourceLabel || 'CSV Import';
  const recruiterIds = importedLeads.map((lead) => lead.assignedRecruiter);
  const nameById = await buildRecruiterNameMap(recruiterIds);

  if (importedLeads.length <= maxPerLead) {
    for (const lead of importedLeads) {
      const recruiterId = String(lead.assignedRecruiter);
      await sendNewLeadNotification(lead, {
        sourceLabel,
        recruiterId,
        recruiterName: nameById.get(recruiterId),
      });
    }
    return;
  }

  await sendCsvImportSummaryNotification(importedLeads, { sourceLabel });
}

/**
 * Fire-and-forget Slack notification for a newly created lead.
 */
export function notifyNewLeadSlack(lead, options = {}) {
  if (!isSlackLeadNotificationsEnabled() || !lead) return;

  setImmediate(() => {
    sendNewLeadNotification(lead, options).catch((err) => {
      console.error('[slack] New lead notification failed:', err.message);
    });
  });
}

/**
 * CSV import: per-lead Slack messages up to SLACK_CSV_IMPORT_PER_LEAD_MAX (default 10),
 * otherwise one summary with lead counts per recruiter.
 */
export function notifyCsvImportSlack(importedLeads, options = {}) {
  if (!isSlackLeadNotificationsEnabled() || !importedLeads?.length) return;

  setImmediate(() => {
    sendCsvImportNotifications(importedLeads, options).catch((err) => {
      console.error('[slack] CSV import notification failed:', err.message);
    });
  });
}

export { isSlackLeadNotificationsEnabled, sendNewLeadNotification };
