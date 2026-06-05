import { ROLES } from '../config/constants.js';

export function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient role permissions' });
    }

    next();
  };
}

export function isAdminOrAbove(user) {
  return user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN;
}

export function isSuperAdmin(user) {
  return user.role === ROLES.SUPER_ADMIN;
}

export function canManageTargetUser(actor, target) {
  if (actor.role === ROLES.SUPER_ADMIN) return true;
  if (actor.role === ROLES.ADMIN) {
    return target.role === ROLES.USER;
  }
  return false;
}
