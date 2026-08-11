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

async function sendNewLeadNotification(lead, options = {}) {
  if (!isSlackLeadNotificationsEnabled()) return;

  const webhookUrl = process.env.SLACK_WEBHOOK_URL.trim();
  const recruiterName = await resolveRecruiterName(lead, options);
  const recruiterId = resolveRecruiterId(lead, options);
  const baseUrl = getFrontendBaseUrl();
  const boardUrl = baseUrl && recruiterId ? `${baseUrl}/recruiting/boards/${recruiterId}` : null;

  const payload = buildSlackPayload(lead, {
    sourceLabel: options.sourceLabel,
    recruiterName,
    boardUrl,
  });

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

export { isSlackLeadNotificationsEnabled, sendNewLeadNotification };
