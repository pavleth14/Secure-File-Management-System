import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { Group } from '../models/Group.js';
import { ROLES, REGISTRATION_ALLOWED_ROLES } from '../config/constants.js';
import {
  signAccessToken,
  signRefreshToken,
  getRefreshExpiryDate,
  verifyRefreshToken,
  decodeAccessToken,
  generateSessionId,
} from '../utils/tokens.js';
import {
  getAccessTokenCookieOptions,
  getClearCookieOptions,
} from '../config/cookies.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { auditLog, buildActorLabel } from '../services/auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';
import {
  validateSessionActivity,
  revokeSession,
  getSessionForUser,
} from '../services/sessionService.js';
import {
  notifySessionRevoked,
  registerSessionStream,
  unregisterSessionStream,
} from '../services/sessionNotifyService.js';
import { verifyAccessToken } from '../utils/tokens.js';
import {
  isValidEmail,
  EMAIL_INVALID_MESSAGE,
} from '../utils/emailValidation.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later' },
});

function setAccessTokenCookie(res, accessToken) {
  res.cookie('accessToken', accessToken, getAccessTokenCookieOptions());
}

function clearAuthCookies(res) {
  const options = getClearCookieOptions();
  res.clearCookie('accessToken', options);
  // Clear any legacy refreshToken cookie set by older builds. The refresh token
  // is no longer exposed to the browser, but this keeps existing clients clean.
  res.clearCookie('refreshToken', options);
}

async function createSession(user, res) {
  const sid = generateSessionId();
  const accessToken = signAccessToken(user, sid);
  // The refresh token is persisted server-side ONLY. It is never sent to the
  // browser (no cookie, no response body) and is used solely to validate and
  // rotate the access token from the server.
  const refreshToken = signRefreshToken(user, sid);

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    sid,
    expiresAt: getRefreshExpiryDate(),
    lastActivityAt: new Date(),
  });

  setAccessTokenCookie(res, accessToken);

  return accessToken;
}

async function getUserIdFromAccessCookie(req) {
  const token = req.cookies.accessToken;
  if (!token) return null;

  try {
    const decoded = decodeAccessToken(token);
    return decoded.userId;
  } catch {
    return null;
  }
}

// Registration is NOT public. Only authenticated, authorized roles may create
// accounts (enforced server-side regardless of any frontend route guard).
router.post('/register', authLimiter, authMiddleware, async (req, res, next) => {
  try {
    if (!REGISTRATION_ALLOWED_ROLES.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'You are not authorized to register new accounts' });
    }

    const { name, email, password, role, groupId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: EMAIL_INVALID_MESSAGE });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const assignedRole = role || ROLES.USER;
    if (assignedRole === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Cannot create super admin via API' });
    }
    if (assignedRole === ROLES.ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Only super admin can create admins' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(400).json({ message: 'Invalid group' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: assignedRole,
      groupId: groupId || null,
    });

    // Note: we intentionally do NOT create a session here — the registering
    // admin stays logged in; the new account does not get auto-authenticated.
    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.USER_CREATE,
      category: AUDIT_CATEGORIES.USERS,
      targetType: TARGET_TYPES.USER,
      targetId: user._id,
      targetName: user.name,
      details: `${buildActorLabel(req.user)} registered account ${user.name}`,
      newValues: { name: user.name, email: user.email, role: user.role },
      req,
    });

    const populated = await User.findById(user._id)
      .select('-passwordHash')
      .populate('groupId', 'name');

    res.status(201).json({
      user: sanitizeUser(populated),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: EMAIL_INVALID_MESSAGE });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await auditLog({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        category: AUDIT_CATEGORIES.AUTH,
        targetType: TARGET_TYPES.AUTH,
        targetName: email.toLowerCase(),
        details: `Failed login attempt for user ${email.toLowerCase()}`,
        req,
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await auditLog({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        category: AUDIT_CATEGORIES.AUTH,
        targetType: TARGET_TYPES.AUTH,
        targetName: user.email,
        details: `Failed login attempt for user ${user.email}`,
        req,
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await RefreshToken.deleteMany({ userId: user._id });
    notifySessionRevoked(user._id);

    await createSession(user, res);

    const populated = await User.findById(user._id)
      .select('-passwordHash')
      .populate('groupId', 'name');

    await auditLog({
      user,
      action: AUDIT_ACTIONS.LOGIN,
      category: AUDIT_CATEGORIES.AUTH,
      targetType: TARGET_TYPES.AUTH,
      targetId: user._id,
      targetName: user.name,
      details: `${buildActorLabel(user)} logged in`,
      req,
    });

    res.json({
      user: sanitizeUser(populated),
    });
  } catch (err) {
    next(err);
  }
});

// Resolves the active session for a refresh request. Because the refresh token
// is never sent to the client, the user is identified from the access-token
// cookie (its signature is verified, but expiry is ignored so an expired
// access token can still be refreshed). The session id embedded in the cookie
// must match the single active session stored in the database, otherwise the
// session has been revoked (logged out or signed in on another device).
async function resolveRefreshSession(req) {
  const token = req.cookies.accessToken;
  if (!token) return null;

  let decodedAccess;
  try {
    decodedAccess = decodeAccessToken(token);
  } catch {
    return null;
  }

  const userId = decodedAccess.userId;
  const stored = await RefreshToken.findOne({ userId });
  if (!stored) {
    return { userId, stored: null, revoked: Boolean(decodedAccess.sid) };
  }
  if (stored.expiresAt < new Date()) {
    return { userId, stored: null };
  }

  // The cookie's session id must match the current active session.
  if (!decodedAccess.sid || stored.sid !== decodedAccess.sid) {
    return { userId, stored: null, revoked: true };
  }

  // Validate the server-side refresh token itself (signature + expiry).
  try {
    verifyRefreshToken(stored.token);
    return { userId, stored };
  } catch {
    return { userId, stored: null };
  }
}

router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const session = await resolveRefreshSession(req);
    if (!session?.userId || !session.stored) {
      clearAuthCookies(res);
      if (session?.stored) {
        await RefreshToken.deleteOne({ _id: session.stored._id });
      }
      if (session?.revoked) {
        return res.status(401).json({
          message: 'Session ended because your account was used on another device',
          code: 'SESSION_REVOKED',
        });
      }
      return res.status(401).json({ message: 'Session expired or revoked' });
    }

    const activity = await validateSessionActivity(session.stored);
    if (!activity.valid) {
      await revokeSession(session.stored);
      clearAuthCookies(res);

      if (activity.reason === 'inactive') {
        return res.status(401).json({
          message: 'Session expired due to inactivity',
          code: 'INACTIVITY_TIMEOUT',
        });
      }

      return res.status(401).json({ message: 'Session expired or revoked' });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      await RefreshToken.deleteOne({ _id: session.stored._id });
      clearAuthCookies(res);
      return res.status(401).json({ message: 'User not found' });
    }

    // Preserve the existing session id across token rotation so the active
    // session identity stays stable until the user logs out or logs in elsewhere.
    const sid = session.stored.sid || generateSessionId();
    const accessToken = signAccessToken(user, sid);
    // Rotate the server-only refresh token and slide the session expiry. The
    // new refresh token is stored in the DB and never returned to the client.
    const newRefreshToken = signRefreshToken(user, sid);

    await RefreshToken.deleteOne({ _id: session.stored._id });
    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      sid,
      expiresAt: getRefreshExpiryDate(),
      lastActivityAt: new Date(),
    });

    setAccessTokenCookie(res, accessToken);

    res.json({ message: 'Token refreshed' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    // Identify the user from the access-token cookie (signature verified, expiry
    // ignored so logout works even with an expired token).
    const userId = await getUserIdFromAccessCookie(req);

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        await auditLog({
          user,
          action: AUDIT_ACTIONS.LOGOUT,
          category: AUDIT_CATEGORIES.AUTH,
          targetType: TARGET_TYPES.AUTH,
          targetId: user._id,
          targetName: user.name,
          details: `${buildActorLabel(user)} logged out`,
          req,
        });
      }
      // Fully invalidate the session server-side: delete every stored refresh
      // token for the user so no access token can be refreshed afterwards.
      await RefreshToken.deleteMany({ userId });
    }

    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-passwordHash')
      .populate('groupId', 'name');
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/session-events', async (req, res, next) => {
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
      clearAuthCookies(res);
      if (activity.reason === 'inactive') {
        return res.status(401).json({
          message: 'Session expired due to inactivity',
          code: 'INACTIVITY_TIMEOUT',
        });
      }
      return res.status(401).json({ message: 'Session expired or revoked' });
    }

    if (!decoded.sid || !session?.sid || decoded.sid !== session.sid) {
      clearAuthCookies(res);
      return res.status(401).json({
        message: 'Session ended because your account was used on another device',
        code: 'SESSION_REVOKED',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const userId = user._id.toString();
    registerSessionStream(userId, res);

    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unregisterSessionStream(userId, res);
    });
  } catch (err) {
    next(err);
  }
});

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : user;
  return {
    id: obj._id,
    name: obj.name,
    email: obj.email,
    role: obj.role,
    groupId: obj.groupId?._id || obj.groupId || null,
    group: obj.groupId?.name ? { id: obj.groupId._id, name: obj.groupId.name } : null,
  };
}

export default router;
