import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_MS,
} from '../config/constants.js';

export function generateSessionId() {
  return uuidv4();
}

export function signAccessToken(user, sid) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      groupId: user.groupId?.toString() || null,
      sid: sid || null,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function signRefreshToken(user, sid) {
  return jwt.sign(
    { userId: user._id.toString(), sid: sid || null, jti: uuidv4() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}


export function getRefreshExpiryDate() {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function decodeAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    ignoreExpiration: true,
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}
