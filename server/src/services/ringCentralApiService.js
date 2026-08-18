import {
  getRingCentralWebhookUrl,
  RINGCENTRAL_SUBSCRIPTION_TTL_SECONDS,
} from '../config/ringCentralConfig.js';
import { ringCentralApiRequest } from './ringCentralAuthService.js';

const TELEPHONY_EVENT_FILTER = '/restapi/v1.0/account/~/telephony/sessions';
const SMS_EVENT_FILTER =
  '/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS';

export async function listRingCentralSubscriptions() {
  const data = await ringCentralApiRequest('/restapi/v1.0/subscription');
  return data?.records || [];
}

export async function deleteRingCentralSubscription(subscriptionId) {
  await ringCentralApiRequest(`/restapi/v1.0/subscription/${subscriptionId}`, {
    method: 'DELETE',
  });
}

export async function createRingCentralWebhookSubscription() {
  const webhookUrl = getRingCentralWebhookUrl();
  const verificationToken = process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN?.trim() || undefined;

  const payload = {
    eventFilters: [TELEPHONY_EVENT_FILTER, SMS_EVENT_FILTER],
    expiresIn: RINGCENTRAL_SUBSCRIPTION_TTL_SECONDS,
    deliveryMode: {
      transportType: 'WebHook',
      address: webhookUrl,
      ...(verificationToken ? { verificationToken } : {}),
    },
  };

  return ringCentralApiRequest('/restapi/v1.0/subscription', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchCallLogRecords({ phoneNumber, dateFrom, dateTo, perPage = 100 } = {}) {
  const params = new URLSearchParams({
    view: 'Detailed',
    perPage: String(perPage),
  });

  if (phoneNumber) params.set('phoneNumber', phoneNumber);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const data = await ringCentralApiRequest(
    `/restapi/v1.0/account/~/call-log?${params.toString()}`
  );
  return data?.records || [];
}

export async function fetchSmsRecords({ extensionId, dateFrom, dateTo, perPage = 100 } = {}) {
  const params = new URLSearchParams({
    messageType: 'SMS',
    perPage: String(perPage),
  });

  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const basePath = extensionId
    ? `/restapi/v1.0/account/~/extension/${extensionId}/message-store`
    : '/restapi/v1.0/account/~/extension/~/message-store';

  const data = await ringCentralApiRequest(`${basePath}?${params.toString()}`);
  return data?.records || [];
}

export async function fetchMessageById(messageId, extensionId) {
  const path = extensionId
    ? `/restapi/v1.0/account/~/extension/${extensionId}/message-store/${messageId}`
    : `/restapi/v1.0/account/~/extension/~/message-store/${messageId}`;
  return ringCentralApiRequest(path);
}

export { TELEPHONY_EVENT_FILTER, SMS_EVENT_FILTER };
