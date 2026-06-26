function parseAllowedOrigins() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isPrivateLanOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
    origin
  );
}

function getRegistrableDomain(hostname) {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

function isSameSiteFamily(origin, allowedOrigins) {
  try {
    const originHost = new URL(origin).hostname;
    const originDomain = getRegistrableDomain(originHost);

    return allowedOrigins.some((allowed) => {
      const allowedHost = new URL(allowed).hostname;
      const allowedDomain = getRegistrableDomain(allowedHost);
      return originDomain === allowedDomain;
    });
  } catch {
    return false;
  }
}

export function corsOriginChecker(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowedOrigins = parseAllowedOrigins();

  if (allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  // Cross-origin cookie deployments (frontend + API on sibling subdomains) must
  // allow preflight on multipart uploads from any subdomain of FRONTEND_URL domains.
  if (
    process.env.COOKIE_CROSS_ORIGIN === 'true' &&
    isSameSiteFamily(origin, allowedOrigins)
  ) {
    callback(null, true);
    return;
  }

  if (process.env.NODE_ENV !== 'production' && isPrivateLanOrigin(origin)) {
    callback(null, true);
    return;
  }

  console.warn(`CORS rejected origin: ${origin}`);
  callback(null, false);
}
