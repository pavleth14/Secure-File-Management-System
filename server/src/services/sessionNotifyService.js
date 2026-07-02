/**
 * In-memory registry of open session event streams (SSE).
 * Used to notify an active browser immediately when the same user logs in elsewhere.
 */

const streamsByUserId = new Map();

function getUserKey(userId) {
  return userId?.toString?.() || String(userId);
}

export function registerSessionStream(userId, res) {
  const key = getUserKey(userId);
  if (!streamsByUserId.has(key)) {
    streamsByUserId.set(key, new Set());
  }
  streamsByUserId.get(key).add(res);
}

export function unregisterSessionStream(userId, res) {
  const key = getUserKey(userId);
  const streams = streamsByUserId.get(key);
  if (!streams) return;

  streams.delete(res);
  if (streams.size === 0) {
    streamsByUserId.delete(key);
  }
}

export function notifySessionRevoked(userId) {
  const key = getUserKey(userId);
  const streams = streamsByUserId.get(key);
  if (!streams?.size) return;

  const payload = JSON.stringify({ type: 'session-revoked' });

  for (const res of streams) {
    try {
      res.write(`event: session-revoked\n`);
      res.write(`data: ${payload}\n\n`);
    } catch {
      // Connection may already be closed.
    }
  }
}
