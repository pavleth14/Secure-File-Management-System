export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

export function getUserAgent(req) {
  return req.headers['user-agent'] || null;
}

export function getRequestMeta(req) {
  return {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}
