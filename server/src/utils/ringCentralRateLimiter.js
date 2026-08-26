const MIN_REQUEST_INTERVAL_MS = 900;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 60_000;

let lastRequestAt = 0;
let rateLimitedUntil = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  rateLimitedUntil = Date.now() + retryAfterMs;
}

export function getRateLimitedUntil() {
  return rateLimitedUntil;
}
