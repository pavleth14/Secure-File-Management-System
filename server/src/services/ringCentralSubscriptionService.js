import {
  isRingCentralEnabled,
  getRingCentralWebhookUrl,
} from '../config/ringCentralConfig.js';
import {
  createRingCentralWebhookSubscription,
  listRingCentralSubscriptions,
  deleteRingCentralSubscription,
} from './ringCentralApiService.js';
import { migrateLeadPhoneDigits } from './ringCentralEventService.js';
import {
  reconcileCallLogSyncQueue,
  startRingCentralCallSyncWorker,
} from './ringCentralCallSyncService.js';

export async function ensureRingCentralWebhookSubscription() {
  if (!isRingCentralEnabled()) {
    console.log('[ringcentral] Integration disabled (missing env configuration)');
    return null;
  }

  const webhookUrl = getRingCentralWebhookUrl();
  const existing = await listRingCentralSubscriptions();
  const matching = existing.filter(
    (sub) =>
      sub?.deliveryMode?.transportType === 'WebHook' &&
      sub?.deliveryMode?.address === webhookUrl &&
      sub?.status !== 'Cancelled'
  );

  for (const sub of matching.slice(1)) {
    try {
      await deleteRingCentralSubscription(sub.id);
      console.log('[ringcentral] Removed duplicate subscription', sub.id);
    } catch (err) {
      console.warn('[ringcentral] Failed to remove duplicate subscription', sub.id, err.message);
    }
  }

  if (matching.length > 0) {
    console.log('[ringcentral] Webhook subscription already active', matching[0].id);
    return matching[0];
  }

  const created = await createRingCentralWebhookSubscription();
  console.log('[ringcentral] Webhook subscription created', created?.id);
  return created;
}

export async function initializeRingCentralIntegration() {
  if (!isRingCentralEnabled()) {
    return;
  }

  try {
    const migrated = await migrateLeadPhoneDigits();
    if (migrated) {
      console.log(`[ringcentral] Backfilled phoneDigits on ${migrated} leads`);
    }
  } catch (err) {
    console.warn('[ringcentral] phoneDigits migration failed', err.message);
  }

  try {
    await ensureRingCentralWebhookSubscription();
  } catch (err) {
    console.error('[ringcentral] Failed to ensure webhook subscription:', err.message);
    console.error(
      '[ringcentral] Ensure webhook URL is reachable and returns Validation-Token header'
    );
  }

  try {
    const reconciled = await reconcileCallLogSyncQueue();
    if (reconciled.enqueued) {
      console.log('[ringcentral] Reconciled unsynced call events on startup', reconciled.enqueued);
    }
    startRingCentralCallSyncWorker();
  } catch (err) {
    console.warn('[ringcentral] Call log sync worker startup failed', err.message);
  }
}
