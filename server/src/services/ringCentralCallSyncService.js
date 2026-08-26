import { RingCentralCallSync } from '../models/RingCentralCallSync.js';
import { RingCentralWorkerLock } from '../models/RingCentralWorkerLock.js';
import { Lead } from '../models/Lead.js';
import { isRingCentralEnabled } from '../config/ringCentralConfig.js';
import { getRateLimitedUntil } from '../utils/ringCentralRateLimiter.js';

/** Wait before first Call Log fetch — RC needs time to finalize duration. */
export const INITIAL_CALL_LOG_DELAY_MS = 45_000;

/** Retry delays after each failed attempt (ms). */
export const CALL_LOG_SYNC_RETRY_DELAYS_MS = [
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
];

const WORKER_INTERVAL_MS = 5_000;
const BATCH_SIZE = 1;
const WORKER_LOCK_ID = 'call-log-sync-worker';
const WORKER_LOCK_TTL_MS = 45_000;
const STALE_PENDING_HOURS = 48;

let workerTimer = null;
let workerRunning = false;
const workerOwner = `${process.pid}-${Date.now()}`;

function getNextAttemptAt(attempts, { rateLimited = false } = {}) {
  if (rateLimited) {
    const waitMs = Math.max(getRateLimitedUntil() - Date.now(), 120_000);
    return new Date(Date.now() + waitMs);
  }

  const delayMs =
    CALL_LOG_SYNC_RETRY_DELAYS_MS[Math.min(attempts, CALL_LOG_SYNC_RETRY_DELAYS_MS.length - 1)];
  return new Date(Date.now() + delayMs);
}

async function acquireWorkerLock() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WORKER_LOCK_TTL_MS);

  const result = await RingCentralWorkerLock.findOneAndUpdate(
    {
      _id: WORKER_LOCK_ID,
      $or: [{ expiresAt: { $lte: now } }, { owner: workerOwner }],
    },
    { $set: { owner: workerOwner, expiresAt } },
    { upsert: true, new: true }
  );

  return result?.owner === workerOwner;
}

async function releaseWorkerLock() {
  await RingCentralWorkerLock.updateOne(
    { _id: WORKER_LOCK_ID, owner: workerOwner },
    { $set: { expiresAt: new Date(0) } }
  );
}

export async function cleanupStalePendingCallSyncJobs({ maxAgeHours = STALE_PENDING_HOURS } = {}) {
  if (!isRingCentralEnabled()) return { cleaned: 0 };

  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const result = await RingCentralCallSync.updateMany(
    {
      syncedAt: null,
      createdAt: { $lt: cutoff },
    },
    {
      $set: {
        syncedAt: new Date(),
        lastError: 'stale_abandoned',
      },
    }
  );

  const cleaned = result.modifiedCount || 0;
  if (cleaned) {
    console.log('[ringcentral] Abandoned stale pending sync jobs', cleaned);
  }

  return { cleaned };
}

export async function enqueueCallLogSync(context) {
  if (!context?.ringCentralEventId || !context?.telephonySessionId || !context?.externalPhone) {
    return null;
  }

  const { findLeadByPhoneNumber } = await import('./ringCentralEventService.js');
  const lead = await findLeadByPhoneNumber(context.externalPhone);
  if (!lead) {
    return null;
  }

  const sessionId = String(context.telephonySessionId);
  const pendingForSession = await RingCentralCallSync.findOne({
    telephonySessionId: sessionId,
    syncedAt: null,
  });
  if (pendingForSession) {
    return pendingForSession;
  }

  const now = new Date();
  const firstAttemptAt = new Date(now.getTime() + INITIAL_CALL_LOG_DELAY_MS);
  const doc = {
    ringCentralEventId: context.ringCentralEventId,
    telephonySessionId: sessionId,
    extensionId: context.extensionId ? String(context.extensionId) : null,
    direction: context.direction === 'Inbound' ? 'Inbound' : 'Outbound',
    externalPhone: context.externalPhone,
    fallbackResult: context.fallbackResult || '',
    occurredAt: context.occurredAt || now,
    attempts: 0,
    nextAttemptAt: firstAttemptAt,
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
    if (err.code === 11000) {
      return RingCentralCallSync.findOne({ ringCentralEventId: doc.ringCentralEventId });
    }
    console.error(
      '[ringcentral] failed to enqueue call log sync',
      doc.ringCentralEventId,
      err.message
    );
    return null;
  }
}

export async function processCallLogSyncEntry(entry) {
  const { syncCallEventFromCallLog, SYNC_RESULT } = await import('./ringCentralEventService.js');
  const context = {
    telephonySessionId: entry.telephonySessionId,
    extensionId: entry.extensionId,
    direction: entry.direction,
    externalPhone: entry.externalPhone,
    ringCentralEventId: entry.ringCentralEventId,
    fallbackResult: entry.fallbackResult,
    occurredAt: entry.occurredAt,
    allowPhoneFallback: entry.attempts >= 4,
    tryExtensionFallback: entry.attempts >= 3,
  };

  try {
    const result = await syncCallEventFromCallLog(context);

    if (result.status === SYNC_RESULT.WRITTEN || result.status === SYNC_RESULT.ALREADY_SYNCED) {
      entry.syncedAt = new Date();
      entry.lastError = null;
      await entry.save();
      await RingCentralCallSync.updateMany(
        {
          telephonySessionId: entry.telephonySessionId,
          syncedAt: null,
          _id: { $ne: entry._id },
        },
        { $set: { syncedAt: new Date(), lastError: 'deduped_session' } }
      );
      return { synced: true };
    }

    if (result.status === SYNC_RESULT.NO_LEAD) {
      entry.syncedAt = new Date();
      entry.lastError = 'no_lead';
      await entry.save();
      return { synced: false, abandoned: true };
    }

    entry.attempts += 1;
    entry.lastError = result.status;

    const rateLimited = result.status === SYNC_RESULT.RATE_LIMITED;
    entry.nextAttemptAt = getNextAttemptAt(entry.attempts, { rateLimited });

    if (entry.attempts >= CALL_LOG_SYNC_RETRY_DELAYS_MS.length) {
      entry.syncedAt = new Date();
      entry.lastError = 'max_attempts_reached';
      console.warn(
        '[ringcentral] call log sync abandoned',
        entry.ringCentralEventId,
        entry.externalPhone
      );
    }

    await entry.save();
    return { synced: false, attempts: entry.attempts };
  } catch (err) {
    entry.attempts += 1;
    entry.lastError = err.message || 'sync_failed';
    const rateLimited = err.status === 429;
    entry.nextAttemptAt = getNextAttemptAt(entry.attempts, { rateLimited });

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

  if (Date.now() < getRateLimitedUntil()) {
    return { processed: 0, synced: 0, rateLimited: true };
  }

  const hasLock = await acquireWorkerLock();
  if (!hasLock) {
    return { processed: 0, synced: 0, locked: true };
  }

  try {
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
  } finally {
    await releaseWorkerLock();
  }
}

/** Re-queue legacy provisional events and remove 0s placeholders from leads. */
export async function reconcileCallLogSyncQueue({ maxAgeHours = STALE_PENDING_HOURS } = {}) {
  if (!isRingCentralEnabled()) return { enqueued: 0, cleaned: 0 };

  const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const leads = await Lead.find({
    'ringCentralEvents.type': 'call',
    'ringCentralEvents.callLogSynced': false,
    'ringCentralEvents.occurredAt': { $gte: since },
  })
    .select('phone ringCentralEvents')
    .limit(500);

  let enqueued = 0;
  let cleaned = 0;

  for (const lead of leads) {
    let leadDirty = false;
    const keepEvents = [];

    for (const event of lead.ringCentralEvents || []) {
      const isProvisionalCall =
        event.type === 'call' &&
        !event.callLogSynced &&
        event.ringCentralEventId?.startsWith('call:session:');

      if (!isProvisionalCall) {
        keepEvents.push(event);
        continue;
      }

      cleaned += 1;
      leadDirty = true;

      const parts = String(event.ringCentralEventId).split(':');
      const telephonySessionId = parts[2];
      if (!telephonySessionId) continue;

      const pendingForSession = await RingCentralCallSync.findOne({
        telephonySessionId,
        syncedAt: null,
      });

      if (!pendingForSession) {
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

    if (leadDirty) {
      lead.ringCentralEvents = keepEvents;
      await lead.save();
    }
  }

  if (enqueued || cleaned) {
    console.log('[ringcentral] Reconciled call log queue', { enqueued, cleaned });
  }

  return { enqueued, cleaned };
}

export function startRingCentralCallSyncWorker() {
  if (!isRingCentralEnabled() || workerTimer) return;

  console.log(
    '[ringcentral] Call log sync worker started (write-once, 1 job/tick, throttled API)'
  );

  const tick = async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      const result = await processDueCallLogSyncs();
      if (result.synced > 0) {
        console.log('[ringcentral] Call events written from call log', result.synced);
      }
    } catch (err) {
      console.error('[ringcentral] Call log sync worker error', err.message);
    } finally {
      workerRunning = false;
    }
  };

  workerTimer = setInterval(tick, WORKER_INTERVAL_MS);
  if (typeof workerTimer.unref === 'function') {
    workerTimer.unref();
  }
}

export function stopRingCentralCallSyncWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

export async function initializeRingCentralCallSync() {
  await cleanupStalePendingCallSyncJobs();
  await reconcileCallLogSyncQueue();
  startRingCentralCallSyncWorker();
}
