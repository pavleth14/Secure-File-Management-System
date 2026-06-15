import {
  ACCESS_TOKEN_EXPIRY_MS,
  REFRESH_TOKEN_EXPIRY_MS,
} from './constants.js';

function baseCookieOptions() {
  const crossOrigin = process.env.COOKIE_CROSS_ORIGIN === 'true';

  return {
    httpOnly: true,
    secure: crossOrigin || process.env.NODE_ENV === 'production',
    sameSite: crossOrigin ? 'none' : 'lax',
    path: '/',
  };
}

export function getAccessTokenCookieOptions() {
  return {
    ...baseCookieOptions(),
    maxAge: ACCESS_TOKEN_EXPIRY_MS,
  };
}

export function getRefreshTokenCookieOptions() {
  return {
    ...baseCookieOptions(),
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
  };
}

export function getClearCookieOptions() {
  return baseCookieOptions();
}
