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

  if (process.env.NODE_ENV !== 'production' && isPrivateLanOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(null, false);
}
