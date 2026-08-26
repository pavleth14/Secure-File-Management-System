import { getRingCentralServer } from '../config/ringCentralConfig.js';
import {
  waitForRingCentralRateLimit,
} from '../utils/ringCentralRateLimiter.js';

let cachedToken = null;
let tokenExpiresAt = 0;

function getBasicAuthHeader() {
  const clientId = process.env.RINGCENTRAL_CLIENT_ID?.trim();
  const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('RingCentral client credentials are not configured');
  }
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  return `Basic ${encoded}`;
}

export async function getRingCentralAccessToken({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const jwt = process.env.RINGCENTRAL_JWT?.trim();
  if (!jwt) {
    throw new Error('RINGCENTRAL_JWT is not configured');
  }

  const response = await fetch(`${getRingCentralServer()}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.message || body?.error_description || response.statusText;
    throw new Error(`RingCentral auth failed (${response.status}): ${message}`);
  }

  cachedToken = body.access_token;
  const expiresInSec = Number(body.expires_in) || 3600;
  tokenExpiresAt = now + expiresInSec * 1000;
  return cachedToken;
}

export async function ringCentralApiRequest(path, options = {}) {
  await waitForRingCentralRateLimit();

  const token = await getRingCentralAccessToken();
  const url = path.startsWith('http') ? path : `${getRingCentralServer()}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    const refreshedToken = await getRingCentralAccessToken({ forceRefresh: true });
    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${refreshedToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return parseRingCentralResponse(retryResponse);
  }

  return parseRingCentralResponse(response);
}

async function parseRingCentralResponse(response) {
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      body?.message ||
      body?.errors?.[0]?.message ||
      (typeof body === 'string' ? body : response.statusText);
    const err = new Error(`RingCentral API error (${response.status}): ${message}`);
    err.status = response.status;
    err.body = body;
    if (response.status === 429) {
      const { parseRetryAfterMs, markRingCentralRateLimited } = await import(
        '../utils/ringCentralRateLimiter.js'
      );
      const retryAfterMs =
        parseRetryAfterMs(response.headers.get('Retry-After')) ?? 120_000;
      markRingCentralRateLimited(retryAfterMs);
    }
    throw err;
  }

  return body;
}
