import { RefreshToken } from '../models/RefreshToken.js';
import { INACTIVITY_TIMEOUT_MS } from '../config/constants.js';

const ACTIVITY_UPDATE_INTERVAL_MS = 60 * 1000;

export function isSessionInactive(lastActivityAt) {
  if (!lastActivityAt) {
    return false;
  }

  return Date.now() - lastActivityAt.getTime() > INACTIVITY_TIMEOUT_MS;
}

export async function getSessionForUser(userId) {
  return RefreshToken.findOne({ userId });
}

export async function touchSession(session) {
  if (!session) {
    return null;
  }

  const now = new Date();
  if (
    session.lastActivityAt &&
    now.getTime() - session.lastActivityAt.getTime() < ACTIVITY_UPDATE_INTERVAL_MS
  ) {
    return session;
  }

  session.lastActivityAt = now;
  await session.save();
  return session;
}

export async function validateSessionActivity(session) {
  if (!session) {
    return { valid: false, reason: 'no_session' };
  }

  if (session.expiresAt < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  if (isSessionInactive(session.lastActivityAt)) {
    return { valid: false, reason: 'inactive' };
  }

  return { valid: true };
}

export async function revokeSession(session) {
  if (session) {
    await RefreshToken.deleteOne({ _id: session._id });
  }
}
