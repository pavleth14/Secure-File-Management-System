import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { isRingCentralEnabled, RINGCENTRAL_BACKFILL_DAYS } from '../config/ringCentralConfig.js';
import { normalizeUsPhoneDigits, toE164UsPhone } from '../utils/usPhone.js';
import { getActiveLeadStatusNames } from './leadStatusService.js';
import {
  fetchCallLogRecords,
  fetchCallLogByTelephonySessionId,
  fetchSmsRecords,
} from './ringCentralApiService.js';

const DEFERRED_CALL_RETRY_DELAYS_MS = [15_000, 45_000, 90_000];
const IGNORED_DISCONNECT_REASONS = new Set(['CallerInputRedirect', 'BlindTransfer']);
const pendingDeferredCallWrites = new Set();

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
  if (secs === 0) return `${minutes} min`;
  return `${minutes} min ${secs}s`;
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
  let durationSec = 0;
  if (record?.durationMs != null && Number(record.durationMs) > 0) {
    durationSec = Math.round(Number(record.durationMs) / 1000);
  } else if (record?.duration != null && Number(record.duration) > 0) {
    durationSec = Math.round(Number(record.duration));
  } else if (record?.billing?.duration != null && Number(record.billing.duration) > 0) {
    durationSec = Math.round(Number(record.billing.duration));
  }

  if (durationSec === 0 && Array.isArray(record?.legs)) {
    for (const leg of record.legs) {
      if (leg?.durationMs != null && Number(leg.durationMs) > 0) {
        durationSec = Math.max(durationSec, Math.round(Number(leg.durationMs) / 1000));
      } else if (leg?.duration != null && Number(leg.duration) > 0) {
        durationSec = Math.max(durationSec, Math.round(Number(leg.duration)));
      }
    }
  }
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

function shouldIgnoreDisconnectParty(party) {
  const reason = party?.status?.reason || party?.reason || '';
  return IGNORED_DISCONNECT_REASONS.has(reason);
}

function parseSessionIdFromEventId(ringCentralEventId) {
  if (!ringCentralEventId || !String(ringCentralEventId).startsWith('call:session:')) {
    return null;
  }
  const parts = String(ringCentralEventId).split(':');
  return parts[2] || null;
}

async function fetchAuthoritativeCallLogRecord({ telephonySessionId, extensionId, direction }) {
  const records = await fetchCallLogByTelephonySessionId({
    telephonySessionId,
    extensionId,
  });
  if (!records.length) return null;

  const directionalMatch = records.find((record) => {
    const recordDirection = record?.direction === 'Inbound' ? 'Inbound' : 'Outbound';
    return recordDirection === direction;
  });

  return directionalMatch || records[0];
}

/**
 * Write call event only after RingCentral Call Log returns the session (accurate duration).
 * Returns true when written or already stored with authoritative data.
 */
async function tryWriteCallEventFromCallLog(context) {
  if (!isRingCentralEnabled() || !context?.externalPhone || !context?.telephonySessionId) {
    return false;
  }

  const lead = await findLeadByPhoneNumber(context.externalPhone);
  if (!lead) return false;

  if (!(await isLeadInActiveStatus(lead))) {
    return false;
  }

  const existing = (lead.ringCentralEvents || []).find(
    (event) => event.ringCentralEventId === context.ringCentralEventId
  );
  if (existing?.callLogSynced) {
    return true;
  }

  const record = await fetchAuthoritativeCallLogRecord({
    telephonySessionId: context.telephonySessionId,
    extensionId: context.extensionId,
    direction: context.direction,
  });
  if (!record) {
    return false;
  }

  const parsed = parseCallLogRecord(record);
  const eventData = {
    type: 'call',
    direction: context.direction,
    durationSec: parsed.durationSec,
    result: parsed.result || context.fallbackResult || 'Unknown',
    extensionId: context.extensionId || parsed.extensionId,
    externalPhone: context.externalPhone,
    occurredAt: parsed.occurredAt || context.occurredAt,
    ringCentralEventId: context.ringCentralEventId,
    callLogSynced: true,
  };

  const result = await appendEventToLead(lead, eventData, { skipActiveCheck: true });
  if (result.added || result.updated) {
    console.log(
      '[ringcentral] Call event saved from call log',
      context.ringCentralEventId,
      `${eventData.durationSec}s`
    );
    return true;
  }

  return false;
}

function scheduleDeferredCallEventRecording(context) {
  const key = context.ringCentralEventId;
  if (!key || pendingDeferredCallWrites.has(key)) {
    return;
  }
  pendingDeferredCallWrites.add(key);

  console.log(
    '[ringcentral] Deferred call write scheduled',
    key,
    `retries at ${DEFERRED_CALL_RETRY_DELAYS_MS.map((ms) => `${ms / 1000}s`).join(', ')}`
  );

  for (const delayMs of DEFERRED_CALL_RETRY_DELAYS_MS) {
    setTimeout(() => {
      tryWriteCallEventFromCallLog(context)
        .then((written) => {
          if (written) {
            pendingDeferredCallWrites.delete(key);
          }
        })
        .catch((err) => {
          console.error('[ringcentral] deferred call write failed', key, err.message);
        });
    }, delayMs);
  }

  setTimeout(() => pendingDeferredCallWrites.delete(key), 120_000);
}

/** Repair call events that were saved with unknown duration (legacy 0s rows). */
export async function repairStaleCallEventDurations(leadId) {
  if (!isRingCentralEnabled()) return { repaired: 0 };

  const lead = await Lead.findById(leadId);
  if (!lead) return { repaired: 0 };

  let repaired = 0;
  const staleEvents = (lead.ringCentralEvents || []).filter(
    (event) =>
      event.type === 'call' &&
      !event.callLogSynced &&
      event.ringCentralEventId?.startsWith('call:session:')
  );

  for (const event of staleEvents) {
    const telephonySessionId = parseSessionIdFromEventId(event.ringCentralEventId);
    if (!telephonySessionId) continue;

    const context = {
      telephonySessionId,
      extensionId: event.extensionId,
      direction: event.direction,
      externalPhone: lead.phone,
      ringCentralEventId: event.ringCentralEventId,
      fallbackResult: event.result,
      occurredAt: event.occurredAt,
    };

    const written = await tryWriteCallEventFromCallLog(context);
    if (written) repaired += 1;
  }

  return { repaired };
}

async function appendEventToLead(lead, eventData, { skipActiveCheck = false } = {}) {
  if (!skipActiveCheck && !(await isLeadInActiveStatus(lead))) {
    return { added: false, reason: 'inactive_status' };
  }

  if (!eventData.ringCentralEventId) {
    return { added: false, reason: 'missing_event_id' };
  }

  const alreadyExists = (lead.ringCentralEvents || []).find(
    (event) => event.ringCentralEventId === eventData.ringCentralEventId
  );
  if (alreadyExists) {
    if (eventData.type === 'call' && eventData.callLogSynced) {
      const recruiter = await findUserByRingCentralExtension(eventData.extensionId, null);
      const recruiterName = formatRecruiterLabel(recruiter, eventData.extensionId);
      const shouldUpdate =
        !alreadyExists.callLogSynced ||
        eventData.durationSec !== (alreadyExists.durationSec || 0) ||
        eventData.result !== alreadyExists.result;

      if (shouldUpdate) {
        alreadyExists.durationSec = eventData.durationSec;
        alreadyExists.result = eventData.result || alreadyExists.result;
        alreadyExists.callLogSynced = true;
        alreadyExists.text = buildCallEventText({
          direction: eventData.direction,
          durationSec: eventData.durationSec,
          result: alreadyExists.result,
          recruiterName,
        });
        alreadyExists.updatedAt = new Date();
        await lead.save();
        return { added: true, updated: true };
      }
      return { added: false, reason: 'duplicate' };
    }

    if (
      eventData.type === 'call' &&
      eventData.durationSec > (alreadyExists.durationSec || 0)
    ) {
      const recruiter = await findUserByRingCentralExtension(eventData.extensionId, null);
      const recruiterName = formatRecruiterLabel(recruiter, eventData.extensionId);
      alreadyExists.durationSec = eventData.durationSec;
      alreadyExists.result = eventData.result || alreadyExists.result;
      alreadyExists.text = buildCallEventText({
        direction: eventData.direction,
        durationSec: eventData.durationSec,
        result: alreadyExists.result,
        recruiterName,
      });
      alreadyExists.updatedAt = new Date();
      await lead.save();
      return { added: true, updated: true };
    }
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
    callLogSynced: Boolean(eventData.callLogSynced),
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
      const result = await appendEventToLead(
        lead,
        { ...parsed, callLogSynced: true },
        { skipActiveCheck: true }
      );
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
  if (!telephonySessionId) return;

  for (const party of parties) {
    if (!partyIsDisconnected(party)) continue;
    if (shouldIgnoreDisconnectParty(party)) continue;

    const direction = party?.direction === 'Inbound' ? 'Inbound' : 'Outbound';
    const externalPhone =
      direction === 'Outbound' ? party?.to?.phoneNumber : party?.from?.phoneNumber;
    if (!externalPhone) continue;

    const extensionId = getExtensionFromParty(party, direction);
    const fallbackResult =
      party?.reason ||
      (party?.missedCall ? 'Missed' : party?.status?.code) ||
      body?.reason ||
      'Unknown';
    const occurredAt = body?.eventTime ? new Date(body.eventTime) : new Date();
    const ringCentralEventId = `call:session:${telephonySessionId}:${extensionId || 'x'}:${direction}`;

    scheduleDeferredCallEventRecording({
      telephonySessionId,
      extensionId,
      direction,
      externalPhone,
      fallbackResult,
      occurredAt,
      ringCentralEventId,
    });
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

  const durationSec = event.durationSec || 0;
  const text =
    event.type === 'call'
      ? buildCallEventText({
          direction: event.direction,
          durationSec,
          result: event.result,
          recruiterName: authorName,
        })
      : event.text;

  return {
    id: event._id,
    type: event.type,
    direction: event.direction,
    durationSec,
    result: event.result,
    text,
    author: authorName,
    authorId: authorDoc?._id || authorDoc || null,
    isSystem: Boolean(event.isSystem),
    occurredAt: event.occurredAt,
    createdAt: event.createdAt || event.occurredAt,
    updatedAt: event.updatedAt || event.occurredAt,
  };
}
