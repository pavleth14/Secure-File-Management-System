export function getRingCentralServer() {
  return (process.env.RINGCENTRAL_SERVER || 'https://platform.ringcentral.com').replace(/\/$/, '');
}

export function getRingCentralWebhookUrl() {
  const explicit = process.env.RINGCENTRAL_WEBHOOK_URL?.trim();
  if (explicit) return explicit;

  const apiBase = process.env.RINGCENTRAL_WEBHOOK_BASE_URL?.trim();
  if (apiBase) {
    return `${apiBase.replace(/\/$/, '')}/api/webhooks/ringcentral`;
  }

  return '';
}

export function isRingCentralEnabled() {
  return Boolean(
    process.env.RINGCENTRAL_CLIENT_ID?.trim() &&
      process.env.RINGCENTRAL_CLIENT_SECRET?.trim() &&
      process.env.RINGCENTRAL_JWT?.trim() &&
      getRingCentralWebhookUrl()
  );
}

export function shouldForceRecreateRingCentralWebhook() {
  const value = String(process.env.RINGCENTRAL_FORCE_RECREATE_WEBHOOK || '')
    .trim()
    .toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export const RINGCENTRAL_BACKFILL_DAYS = 7;

export const RINGCENTRAL_SUBSCRIPTION_TTL_SECONDS = 630720000; // ~20 years (RC max for WebHook)
