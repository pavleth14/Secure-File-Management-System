import { verifyAccessToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { getClearCookieOptions } from '../config/cookies.js';
import {
  getSessionForUser,
  validateSessionActivity,
  touchSession,
  revokeSession,
} from '../services/sessionService.js';

function clearAuthCookies(res) {
  const options = getClearCookieOptions();
  res.clearCookie('accessToken', options);
  res.clearCookie('refreshToken', options);
}

export async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const session = await getSessionForUser(user._id);
    const activity = await validateSessionActivity(session);

    if (!activity.valid) {
      await revokeSession(session);
      clearAuthCookies(res);

      if (activity.reason === 'inactive') {
        return res.status(401).json({
          message: 'Session expired due to inactivity',
          code: 'INACTIVITY_TIMEOUT',
        });
      }

      return res.status(401).json({ message: 'Session expired or revoked' });
    }

    await touchSession(session);

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
