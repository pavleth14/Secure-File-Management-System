import {
  isRingCentralEnabled,
  getRingCentralWebhookUrl,
  shouldForceRecreateRingCentralWebhook,
} from '../config/ringCentralConfig.js';
import {
  createRingCentralWebhookSubscription,
  listRingCentralSubscriptions,
  deleteRingCentralSubscription,
} from './ringCentralApiService.js';
import { migrateLeadPhoneDigits } from './ringCentralEventService.js';
import { initializeRingCentralCallSync } from './ringCentralCallSyncService.js';

function summarizeWebhookSubscription(sub) {
  return {
    id: sub?.id || null,
    status: sub?.status || 'unknown',
    address: sub?.deliveryMode?.address || null,
    eventFilters: (sub?.eventFilters || []).length,
  };
}

async function deleteMatchingWebhookSubscriptions(matching, { keepId = null } = {}) {
  for (const sub of matching) {
    if (keepId && sub.id === keepId) {
      continue;
    }

    try {
      await deleteRingCentralSubscription(sub.id);
      console.log(
        '[ringcentral] Removed webhook subscription',
        sub.id,
        sub.status || 'unknown'
      );
    } catch (err) {
      console.warn('[ringcentral] Failed to remove subscription', sub.id, err.message);
    }
  }
}

export async function ensureRingCentralWebhookSubscription() {
  if (!isRingCentralEnabled()) {
    console.log('[ringcentral] Integration disabled (missing env configuration)');
    return null;
  }

  const webhookUrl = getRingCentralWebhookUrl();
  const forceRecreate = shouldForceRecreateRingCentralWebhook();
  const existing = await listRingCentralSubscriptions();
  const matching = existing.filter(
    (sub) =>
      sub?.deliveryMode?.transportType === 'WebHook' &&
      sub?.deliveryMode?.address === webhookUrl
  );

  if (forceRecreate && matching.length) {
    console.log(
      '[ringcentral] Force recreate enabled — deleting existing webhook subscriptions for',
      webhookUrl
    );
    await deleteMatchingWebhookSubscriptions(matching);
  } else {
    const healthy = matching.filter((sub) => sub?.status === 'Active');

    for (const sub of matching) {
      if (sub?.status === 'Active' && healthy[0]?.id === sub.id) {
        continue;
      }

      try {
        await deleteRingCentralSubscription(sub.id);
        console.log(
          '[ringcentral] Removed stale webhook subscription',
          sub.id,
          sub.status || 'unknown'
        );
      } catch (err) {
        console.warn('[ringcentral] Failed to remove subscription', sub.id, err.message);
      }
    }

    if (healthy.length > 0) {
      const active = healthy[0];
      console.log('[ringcentral] Webhook subscription healthy', summarizeWebhookSubscription(active));
      if (matching.length > 1) {
        await deleteMatchingWebhookSubscriptions(matching, { keepId: active.id });
      }
      return active;
    }
  }

  const created = await createRingCentralWebhookSubscription();
  console.log('[ringcentral] Webhook subscription created', summarizeWebhookSubscription(created));
  return created;
}

export async function recreateRingCentralWebhookSubscription() {
  if (!isRingCentralEnabled()) {
    throw new Error('RingCentral integration disabled (missing env configuration)');
  }

  const webhookUrl = getRingCentralWebhookUrl();
  const existing = await listRingCentralSubscriptions();
  const matching = existing.filter(
    (sub) =>
      sub?.deliveryMode?.transportType === 'WebHook' &&
      sub?.deliveryMode?.address === webhookUrl
  );

  await deleteMatchingWebhookSubscriptions(matching);
  return ensureRingCentralWebhookSubscription();
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
    await initializeRingCentralCallSync();
  } catch (err) {
    console.warn('[ringcentral] Call log sync worker startup failed', err.message);
  }
}
