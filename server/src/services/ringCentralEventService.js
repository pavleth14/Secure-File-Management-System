import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { isRingCentralEnabled, RINGCENTRAL_BACKFILL_DAYS } from '../config/ringCentralConfig.js';
import { normalizeUsPhoneDigits, toE164UsPhone } from '../utils/usPhone.js';
import { getActiveLeadStatusNames } from './leadStatusService.js';
import {
  fetchCallLogRecords,
  fetchSmsRecords,
} from './ringCentralApiService.js';

let activeStatusCache = { names: null, expiresAt: 0 };

async function getCachedActiveStatusNames() {
  const now = Date.now();
  if (activeStatusCache.names && now < activeStatusCache.expiresAt) {
    return activeStatusCache.names;
  }
  const names = await getActiveLeadStatusNames();
  activeStatusCache = { names, expiresAt: now + 60_000 };
  return names;
}

export function formatCallDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  if (safe === 0) return '0s';
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}m ${String(secs).padStart(2, '0')}s`;
}

function formatRecruiterLabel(userDoc, extensionId) {
  if (userDoc?.name) return userDoc.name;
  if (userDoc?.ringCentralExtensionNumber) {
    return `Ext ${userDoc.ringCentralExtensionNumber}`;
  }
  if (extensionId) return `Ext ${extensionId}`;
  return 'Unknown';
}

export function buildCallEventText({ direction, durationSec, result, recruiterName }) {
  const label = direction === 'Inbound' ? 'Inbound call' : 'Outbound call';
  const duration = formatCallDuration(durationSec);
  const outcome = result?.trim() || 'Unknown';
  return `${label} · ${duration} · ${outcome} — ${recruiterName}`;
}

export function buildSmsEventText({ direction, result, recruiterName }) {
  const label = direction === 'Inbound' ? 'SMS received' : 'SMS sent';
  const outcome = result?.trim() || 'Sent';
  return `${label} · ${outcome} — ${recruiterName}`;
}

export async function findUserByRingCentralExtension(extensionId, extensionNumber) {
  if (extensionId) {
    const byId = await User.findOne({ ringCentralExtensionId: String(extensionId) }).select(
      'name ringCentralExtensionId ringCentralExtensionNumber'
    );
    if (byId) return byId;
  }

  if (extensionNumber) {
    return User.findOne({ ringCentralExtensionNumber: String(extensionNumber) }).select(
      'name ringCentralExtensionId ringCentralExtensionNumber'
    );
  }

  return null;
}

export async function findLeadByPhoneNumber(phoneNumber) {
  const digits = normalizeUsPhoneDigits(phoneNumber);
  if (!digits) return null;
  return Lead.findOne({ phoneDigits: digits });
}

async function isLeadInActiveStatus(lead) {
  const activeNames = await getCachedActiveStatusNames();
  return activeNames.includes(lead.status);
}

function getExtensionFromParty(party, direction) {
  if (direction === 'Outbound') {
    return party?.from?.extensionId || party?.extensionId || null;
  }
  return party?.to?.extensionId || party?.extensionId || null;
}

function getExternalPhoneFromCallRecord(record) {
  const direction = record?.direction || 'Outbound';
  if (direction === 'Inbound') {
    return record?.from?.phoneNumber || null;
  }
  return record?.to?.phoneNumber || null;
}

function getExtensionFromCallRecord(record) {
  const direction = record?.direction || 'Outbound';
  if (direction === 'Inbound') {
    return record?.to?.extensionId || null;
  }
  return record?.from?.extensionId || null;
}

function parseCallLogRecord(record) {
  const direction = record?.direction === 'Inbound' ? 'Inbound' : 'Outbound';
  const durationSec = record?.durationMs
    ? Math.round(record.durationMs / 1000)
    : Math.round(Number(record?.duration) || 0);
  const result = record?.result || record?.reason || 'Unknown';
  const extensionId = getExtensionFromCallRecord(record);
  const externalPhone = getExternalPhoneFromCallRecord(record);
  const occurredAt = record?.startTime ? new Date(record.startTime) : new Date();
  const eventId = String(record?.id || record?.telephonySessionId || record?.sessionId || '');

  return {
    type: 'call',
    direction,
    durationSec,
    result,
    extensionId,
    externalPhone,
    occurredAt,
    ringCentralEventId: eventId ? `call:${eventId}` : null,
  };
}

function parseSmsRecord(record) {
  const direction = record?.direction === 'Inbound' ? 'Inbound' : 'Outbound';
  const result = record?.messageStatus || record?.availability || 'Sent';
  const extensionId = record?.from?.extensionId || record?.extensionId || null;
  const externalPhone =
    direction === 'Outbound'
      ? record?.to?.[0]?.phoneNumber || record?.to?.phoneNumber
      : record?.from?.phoneNumber;
  const occurredAt = record?.creationTime ? new Date(record.creationTime) : new Date();
  const eventId = String(record?.id || '');

  return {
    type: 'sms',
    direction,
    durationSec: 0,
    result,
    extensionId,
    externalPhone,
    occurredAt,
    ringCentralEventId: eventId ? `sms:${eventId}` : null,
  };
}

async function appendEventToLead(lead, eventData, { skipActiveCheck = false } = {}) {
  if (!skipActiveCheck && !(await isLeadInActiveStatus(lead))) {
    return { added: false, reason: 'inactive_status' };
  }

  if (!eventData.ringCentralEventId) {
    return { added: false, reason: 'missing_event_id' };
  }

  const alreadyExists = (lead.ringCentralEvents || []).some(
    (event) => event.ringCentralEventId === eventData.ringCentralEventId
  );
  if (alreadyExists) {
    return { added: false, reason: 'duplicate' };
  }

  const recruiter = await findUserByRingCentralExtension(eventData.extensionId, null);
  const recruiterName = formatRecruiterLabel(recruiter, eventData.extensionId);

  const text =
    eventData.type === 'sms'
      ? buildSmsEventText({
          direction: eventData.direction,
          result: eventData.result,
          recruiterName,
        })
      : buildCallEventText({
          direction: eventData.direction,
          durationSec: eventData.durationSec,
          result: eventData.result,
          recruiterName,
        });

  lead.ringCentralEvents.push({
    type: eventData.type,
    direction: eventData.direction,
    durationSec: eventData.durationSec,
    result: eventData.result,
    text,
    ringCentralEventId: eventData.ringCentralEventId,
    author: recruiter?._id || null,
    authorLabel: recruiter ? null : recruiterName,
    extensionId: eventData.extensionId || null,
    isSystem: true,
    occurredAt: eventData.occurredAt,
    createdAt: eventData.occurredAt,
    updatedAt: eventData.occurredAt,
  });

  if (
    eventData.type === 'call' &&
    eventData.direction === 'Outbound' &&
    !lead.firstCalledAt &&
    recruiter &&
    lead.assignedRecruiter?.toString?.() === recruiter._id.toString()
  ) {
    lead.firstCalledAt = eventData.occurredAt;
  }

  await lead.save();
  return { added: true };
}

export async function recordRingCentralEventForPhone(eventData, options = {}) {
  if (!eventData?.externalPhone) {
    return { added: false, reason: 'no_phone' };
  }

  const lead = await findLeadByPhoneNumber(eventData.externalPhone);
  if (!lead) {
    return { added: false, reason: 'lead_not_found' };
  }

  return appendEventToLead(lead, eventData, options);
}

export async function backfillRingCentralEventsForLead(leadId) {
  if (!isRingCentralEnabled()) return { added: 0 };

  const lead = await Lead.findById(leadId);
  if (!lead) return { added: 0 };

  const phoneE164 = toE164UsPhone(lead.phone);
  if (!phoneE164) return { added: 0 };

  const dateFrom = new Date(Date.now() - RINGCENTRAL_BACKFILL_DAYS * 24 * 60 * 60 * 1000);
  const dateFromIso = dateFrom.toISOString();

  let added = 0;

  try {
    const callRecords = await fetchCallLogRecords({
      phoneNumber: phoneE164,
      dateFrom: dateFromIso,
      perPage: 100,
    });

    for (const record of callRecords) {
      const parsed = parseCallLogRecord(record);
      if (!parsed.ringCentralEventId) continue;
      const result = await appendEventToLead(lead, parsed, { skipActiveCheck: true });
      if (result.added) added += 1;
    }
  } catch (err) {
    console.error('[ringcentral] backfill failed for lead', leadId, err.message);
  }

  return { added };
}

function partyIsDisconnected(party) {
  const code = party?.status?.code || party?.status;
  return code === 'Disconnected' || code === 'Gone';
}

async function processTelephonySessionBody(body) {
  const parties = body?.parties || [];
  const telephonySessionId = body?.telephonySessionId || body?.sessionId;

  for (const party of parties) {
    if (!partyIsDisconnected(party)) continue;

    const direction = party?.direction === 'Inbound' ? 'Inbound' : 'Outbound';
    const externalPhone =
      direction === 'Outbound' ? party?.to?.phoneNumber : party?.from?.phoneNumber;

    const extensionId = getExtensionFromParty(party, direction);
    let durationSec = 0;
    if (party?.durationMs) {
      durationSec = Math.round(party.durationMs / 1000);
    } else if (party?.duration) {
      durationSec = Math.round(party.duration);
    }

    const result =
      party?.reason ||
      (party?.missedCall ? 'Missed' : party?.status?.code) ||
      body?.reason ||
      'Unknown';

    const eventId = telephonySessionId
      ? `call:session:${telephonySessionId}:${extensionId || 'x'}:${direction}`
      : null;

    await recordRingCentralEventForPhone(
      {
        type: 'call',
        direction,
        durationSec,
        result,
        extensionId,
        externalPhone,
        occurredAt: body?.eventTime ? new Date(body.eventTime) : new Date(),
        ringCentralEventId: eventId,
      },
      { skipActiveCheck: false }
    );
  }
}

async function processSmsNotificationBody(body) {
  const extensionId = body?.extensionId;
  if (!extensionId) return;

  const dateFrom = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const records = await fetchSmsRecords({ extensionId, dateFrom, perPage: 20 });

  for (const record of records) {
    const parsed = parseSmsRecord({ ...record, extensionId });
    if (!parsed.ringCentralEventId) continue;
    await recordRingCentralEventForPhone(parsed, { skipActiveCheck: false });
  }
}

export async function processRingCentralWebhookPayload(payload) {
  if (!payload || typeof payload !== 'object') return;

  const eventPath = String(payload.event || '');
  const body = payload.body || payload;

  if (eventPath.includes('telephony/sessions') || body?.parties) {
    await processTelephonySessionBody(body);
    return;
  }

  if (eventPath.includes('message-store') || body?.changes) {
    await processSmsNotificationBody(body);
  }
}

export async function migrateLeadPhoneDigits() {
  const leads = await Lead.find({
    $or: [{ phoneDigits: { $exists: false } }, { phoneDigits: '' }],
  })
    .select('_id phone')
    .limit(5000);

  if (!leads.length) return 0;

  let updated = 0;
  for (const lead of leads) {
    const digits = normalizeUsPhoneDigits(lead.phone);
    if (!digits) continue;
    await Lead.updateOne({ _id: lead._id }, { $set: { phoneDigits: digits } });
    updated += 1;
  }

  return updated;
}

export function formatRingCentralEvent(event) {
  const authorDoc = event.author;
  const authorName =
    event.authorLabel ||
    (authorDoc && typeof authorDoc === 'object' && authorDoc.name ? authorDoc.name : null) ||
    'Unknown';

  return {
    id: event._id,
    type: event.type,
    direction: event.direction,
    durationSec: event.durationSec,
    result: event.result,
    text: event.text,
    author: authorName,
    authorId: authorDoc?._id || authorDoc || null,
    isSystem: Boolean(event.isSystem),
    occurredAt: event.occurredAt,
    createdAt: event.createdAt || event.occurredAt,
    updatedAt: event.updatedAt || event.occurredAt,
  };
}
