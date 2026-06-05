import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { Group } from '../models/Group.js';
import { ROLES } from '../config/constants.js';
import {
  signAccessToken,
  signRefreshToken,
  getRefreshExpiryDate,
  verifyRefreshToken,
} from '../utils/tokens.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later' },
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

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

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: getRefreshExpiryDate(),
    });

    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login',  async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    await RefreshToken.deleteMany({ userId: user._id });
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: getRefreshExpiryDate(),
    });

    res.cookie('refreshToken', refreshToken, cookieOptions);

    const populated = await User.findById(user._id)
      .select('-passwordHash')
      .populate('groupId', 'name');

    res.json({
      user: sanitizeUser(populated),
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const stored = await RefreshToken.findOne({ token, userId: decoded.userId });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Refresh token expired or revoked' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
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

    res.cookie('refreshToken', newRefreshToken, cookieOptions);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      await RefreshToken.deleteOne({ token });
    }
    res.clearCookie('refreshToken', { path: '/' });
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
