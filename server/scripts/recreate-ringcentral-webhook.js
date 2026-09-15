import dotenv from 'dotenv';
import { listRingCentralSubscriptions } from '../src/services/ringCentralApiService.js';
import { recreateRingCentralWebhookSubscription } from '../src/services/ringCentralSubscriptionService.js';
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

  const created = await recreateRingCentralWebhookSubscription();

  const after = await listRingCentralSubscriptions();
  console.log('[recreate-ringcentral-webhook] subscriptions after:', after.map(summarizeSubscription));
  console.log('[recreate-ringcentral-webhook] result:', summarizeSubscription(created || {}));
}

main().catch((err) => {
  console.error('[recreate-ringcentral-webhook] failed', err.message);
  process.exit(1);
});
