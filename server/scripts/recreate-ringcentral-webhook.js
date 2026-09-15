import dotenv from 'dotenv';
import {
  listRingCentralSubscriptions,
  deleteRingCentralSubscription,
} from '../src/services/ringCentralApiService.js';
import { ensureRingCentralWebhookSubscription } from '../src/services/ringCentralSubscriptionService.js';
import { getRingCentralWebhookUrl, isRingCentralEnabled } from '../src/config/ringCentralConfig.js';

dotenv.config();

function summarizeSubscription(sub) {
  return {
    id: sub.id,
    status: sub.status,
    transportType: sub.deliveryMode?.transportType || null,
    address: sub.deliveryMode?.address || null,
    eventFilters: (sub.eventFilters || []).slice(0, 4),
  };
}

async function main() {
  if (!isRingCentralEnabled()) {
    console.error('[recreate-ringcentral-webhook] RingCentral integration disabled (check env)');
    process.exit(1);
  }

  const webhookUrl = getRingCentralWebhookUrl();
  console.log('[recreate-ringcentral-webhook] target webhook URL:', webhookUrl);

  const before = await listRingCentralSubscriptions();
  console.log('[recreate-ringcentral-webhook] subscriptions before:', before.map(summarizeSubscription));

  const stale = before.filter(
    (sub) =>
      sub?.deliveryMode?.transportType === 'WebHook' &&
      sub?.deliveryMode?.address === webhookUrl &&
      sub?.status !== 'Active'
  );

  for (const sub of stale) {
    await deleteRingCentralSubscription(sub.id);
    console.log('[recreate-ringcentral-webhook] deleted stale subscription', sub.id, sub.status);
  }

  const knownStaleId = 'cb6950d6-f1b6-4c74-8cbf-0da71bb20749';
  const knownStillPresent = before.find((sub) => sub.id === knownStaleId);
  if (knownStillPresent && knownStillPresent.status !== 'Active') {
    await deleteRingCentralSubscription(knownStaleId);
    console.log('[recreate-ringcentral-webhook] deleted known stale subscription', knownStaleId);
  }

  const created = await ensureRingCentralWebhookSubscription();

  const after = await listRingCentralSubscriptions();
  console.log('[recreate-ringcentral-webhook] subscriptions after:', after.map(summarizeSubscription));
  console.log('[recreate-ringcentral-webhook] ensure result:', summarizeSubscription(created || {}));
}

main().catch((err) => {
  console.error('[recreate-ringcentral-webhook] failed', err.message);
  process.exit(1);
});
