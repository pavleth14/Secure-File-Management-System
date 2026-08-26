import { RingCentralCallSync } from '../models/RingCentralCallSync.js';
import { Lead } from '../models/Lead.js';
import { isRingCentralEnabled } from '../config/ringCentralConfig.js';

/** Retry delays after each failed attempt (ms). Keeps trying ~2 hours total. */
export const CALL_LOG_SYNC_RETRY_DELAYS_MS = [
  15_000,
  30_000,
  45_000,
  60_000,
  90_000,
  120_000,
  180_000,
  300_000,
  300_000,
  600_000,
  600_000,
  900_000,
  900_000,
  1_800_000,
  1_800_000,
  1_800_000,
  1_800_000,
  1_800_000,
  1_800_000,
  1_800_000,
];

const WORKER_INTERVAL_MS = 15_000;
const BATCH_SIZE = 25;

let workerTimer = null;

function getNextAttemptAt(attempts) {
  const delayMs =
    CALL_LOG_SYNC_RETRY_DELAYS_MS[Math.min(attempts, CALL_LOG_SYNC_RETRY_DELAYS_MS.length - 1)];
  return new Date(Date.now() + delayMs);
}

export async function enqueueCallLogSync(context) {
  if (!context?.ringCentralEventId || !context?.telephonySessionId || !context?.externalPhone) {
    return null;
  }

  const now = new Date();
  const doc = {
    ringCentralEventId: context.ringCentralEventId,
    telephonySessionId: String(context.telephonySessionId),
    extensionId: context.extensionId ? String(context.extensionId) : null,
    direction: context.direction === 'Inbound' ? 'Inbound' : 'Outbound',
    externalPhone: context.externalPhone,
    fallbackResult: context.fallbackResult || '',
    occurredAt: context.occurredAt || now,
    attempts: 0,
    nextAttemptAt: now,
    syncedAt: null,
    lastError: null,
  };

  try {
    const entry = await RingCentralCallSync.findOneAndUpdate(
      { ringCentralEventId: doc.ringCentralEventId },
      { $setOnInsert: doc },
      { upsert: true, new: true }
    );
    return entry;
  } catch (err) {
    console.error('[ringcentral] failed to enqueue call log sync', doc.ringCentralEventId, err.message);
    return null;
  }
}

export async function processCallLogSyncEntry(entry) {
  const { syncCallEventFromCallLog } = await import('./ringCentralEventService.js');
  const context = {
    telephonySessionId: entry.telephonySessionId,
    extensionId: entry.extensionId,
    direction: entry.direction,
    externalPhone: entry.externalPhone,
    ringCentralEventId: entry.ringCentralEventId,
    fallbackResult: entry.fallbackResult,
    occurredAt: entry.occurredAt,
  };

  try {
    const written = await syncCallEventFromCallLog(context);
    if (written) {
      entry.syncedAt = new Date();
      entry.lastError = null;
      await entry.save();
      return { synced: true };
    }

    entry.attempts += 1;
    entry.lastError = 'call_log_not_ready';
    entry.nextAttemptAt = getNextAttemptAt(entry.attempts);

    if (entry.attempts >= CALL_LOG_SYNC_RETRY_DELAYS_MS.length) {
      entry.syncedAt = new Date();
      entry.lastError = 'max_attempts_reached';
      console.warn(
        '[ringcentral] call log sync abandoned after max attempts',
        entry.ringCentralEventId,
        entry.externalPhone
      );
    }

    await entry.save();
    return { synced: false, attempts: entry.attempts };
  } catch (err) {
    entry.attempts += 1;
    entry.lastError = err.message || 'sync_failed';
    entry.nextAttemptAt = getNextAttemptAt(entry.attempts);

    if (entry.attempts >= CALL_LOG_SYNC_RETRY_DELAYS_MS.length) {
      entry.syncedAt = new Date();
      console.warn(
        '[ringcentral] call log sync abandoned after errors',
        entry.ringCentralEventId,
        err.message
      );
    }

    await entry.save();
    return { synced: false, error: err.message };
  }
}

export async function processDueCallLogSyncs() {
  if (!isRingCentralEnabled()) return { processed: 0, synced: 0 };

  const now = new Date();
  const due = await RingCentralCallSync.find({
    syncedAt: null,
    nextAttemptAt: { $lte: now },
  })
    .sort({ nextAttemptAt: 1 })
    .limit(BATCH_SIZE);

  let synced = 0;
  for (const entry of due) {
    const result = await processCallLogSyncEntry(entry);
    if (result.synced) synced += 1;
  }

  return { processed: due.length, synced };
}

/** Ensure queue rows exist for lead events still marked callLogSynced=false. */
export async function reconcileCallLogSyncQueue({ maxAgeHours = 48 } = {}) {
  if (!isRingCentralEnabled()) return { enqueued: 0 };

  const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const leads = await Lead.find({
    'ringCentralEvents.type': 'call',
    'ringCentralEvents.callLogSynced': false,
    'ringCentralEvents.occurredAt': { $gte: since },
  })
    .select('phone ringCentralEvents')
    .limit(200);

  let enqueued = 0;

  for (const lead of leads) {
    for (const event of lead.ringCentralEvents || []) {
      if (event.type !== 'call' || event.callLogSynced) continue;
      if (!event.ringCentralEventId?.startsWith('call:session:')) continue;

      const parts = String(event.ringCentralEventId).split(':');
      const telephonySessionId = parts[2];
      if (!telephonySessionId) continue;

      const existing = await RingCentralCallSync.findOne({
        ringCentralEventId: event.ringCentralEventId,
        syncedAt: null,
      });
      if (existing) continue;

      await enqueueCallLogSync({
        telephonySessionId,
        extensionId: event.extensionId,
        direction: event.direction,
        externalPhone: lead.phone,
        ringCentralEventId: event.ringCentralEventId,
        fallbackResult: event.result,
        occurredAt: event.occurredAt,
      });
      enqueued += 1;
    }
  }

  if (enqueued) {
    console.log('[ringcentral] Re-enqueued stale call log sync jobs', enqueued);
  }

  return { enqueued };
}

export function startRingCentralCallSyncWorker() {
  if (!isRingCentralEnabled() || workerTimer) return;

  console.log('[ringcentral] Call log sync worker started (every 15s)');

  const tick = async () => {
    try {
      const result = await processDueCallLogSyncs();
      if (result.synced > 0) {
        console.log('[ringcentral] Call log sync worker updated', result.synced, 'events');
      }
    } catch (err) {
      console.error('[ringcentral] Call log sync worker error', err.message);
    }
  };

  workerTimer = setInterval(tick, WORKER_INTERVAL_MS);
  if (typeof workerTimer.unref === 'function') {
    workerTimer.unref();
  }

  tick();
}

export function stopRingCentralCallSyncWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
