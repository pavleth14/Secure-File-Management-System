import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ROLES } from '../config/constants.js';
import {
  signAccessToken,
  signRefreshToken,
  getRefreshExpiryDate,
  verifyRefreshToken,
  decodeAccessToken,
} from '../utils/tokens.js';
import { REFRESH_TOKEN_EXPIRY_MS } from '../config/constants.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { auditLog, buildActorLabel } from '../services/auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later' },
});

const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: REFRESH_TOKEN_EXPIRY_MS,
  path: '/',
};

function setAccessTokenCookie(res, accessToken) {
  res.cookie('accessToken', accessToken, accessCookieOptions);
}

function clearAccessTokenCookie(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

async function createSession(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: getRefreshExpiryDate(),
  });

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

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: ROLES.USER,
      groupId: null,
    });

    const accessToken = await createSession(user);
    clearAccessTokenCookie(res);
    setAccessTokenCookie(res, accessToken);

    res.status(201).json({
      user: sanitizeUser(user),
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

    const accessToken = await createSession(user);
    clearAccessTokenCookie(res);
    setAccessTokenCookie(res, accessToken);

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

router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const userId = await getUserIdFromAccessCookie(req);
    if (!userId) {
      return res.status(401).json({ message: 'Session expired' });
    }

    const stored = await RefreshToken.findOne({ userId });
    if (!stored || stored.expiresAt < new Date()) {
      clearAccessTokenCookie(res);
      if (stored) {
        await RefreshToken.deleteOne({ _id: stored._id });
      }
      return res.status(401).json({ message: 'Session expired or revoked' });
    }

    try {
      verifyRefreshToken(stored.token);
    } catch {
      await RefreshToken.deleteOne({ _id: stored._id });
      clearAccessTokenCookie(res);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(userId);
    if (!user) {
      await RefreshToken.deleteOne({ _id: stored._id });
      clearAccessTokenCookie(res);
      return res.status(401).json({ message: 'User not found' });
    }

    const accessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    await RefreshToken.deleteOne({ _id: stored._id });
    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      expiresAt: getRefreshExpiryDate(),
    });

    setAccessTokenCookie(res, accessToken);

    res.json({ message: 'Token refreshed' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
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
      await RefreshToken.deleteMany({ userId });
    }
    clearAccessTokenCookie(res);
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
