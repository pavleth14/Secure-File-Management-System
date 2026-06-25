import { REFRESH_TOKEN_EXPIRY_MS } from './constants.js';

function baseCookieOptions() {
  const crossOrigin = process.env.COOKIE_CROSS_ORIGIN === 'true';

  return {
    httpOnly: true,
    secure: crossOrigin || process.env.NODE_ENV === 'production',
    sameSite: crossOrigin ? 'none' : 'lax',
    path: '/',
  };
}

// The access token is the ONLY token exposed to the browser, and it lives in an
// HttpOnly cookie. The JWT inside is short-lived (ACCESS_TOKEN_EXPIRY, 15m) and
// is enforced on every request, but the cookie itself is kept for the full
// session window so that after the JWT expires the browser still presents it.
// `/auth/refresh` decodes that (expired) cookie to identify the user + session
// and mints a fresh access token. The refresh token never leaves the server.
export function getAccessTokenCookieOptions() {
  return {
    ...baseCookieOptions(),
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
  };
}

export function getClearCookieOptions() {
  return baseCookieOptions();
}
