const MIN_REQUEST_INTERVAL_MS = 2_500;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 120_000;

let lastRequestAt = 0;
let rateLimitedUntil = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseRetryAfterMs(retryAfterHeader) {
  if (!retryAfterHeader) return null;

  const trimmed = String(retryAfterHeader).trim();
  const asSeconds = parseInt(trimmed, 10);
  if (!Number.isNaN(asSeconds)) {
    return Math.max(asSeconds * 1000, 30_000);
  }

  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) {
    return Math.max(asDate - Date.now(), 30_000);
  }

  return null;
}

export async function waitForRingCentralRateLimit() {
  const now = Date.now();
  if (now < rateLimitedUntil) {
    await sleep(rateLimitedUntil - now);
  }

  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }

  lastRequestAt = Date.now();
}

export function markRingCentralRateLimited(retryAfterMs = DEFAULT_RATE_LIMIT_BACKOFF_MS) {
  const safeMs = Math.max(Number(retryAfterMs) || DEFAULT_RATE_LIMIT_BACKOFF_MS, 30_000);
  rateLimitedUntil = Date.now() + safeMs;
}

export function getRateLimitedUntil() {
  return rateLimitedUntil;
}
