import { Router } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { ROLES } from '../config/constants.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware, canManageTargetUser } from '../middleware/roleMiddleware.js';
import { auditLog, buildActorLabel } from '../services/auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';
import { isValidEmail, EMAIL_INVALID_MESSAGE } from '../utils/emailValidation.js';
import { formatUserResponse } from '../utils/userFormat.js';
import {
  syncDispatchUserOnCreate,
  applyDispatchUserFlags,
  syncDispatchUserOnUpdate,
} from '../services/dispatchUserService.js';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', async (req, res, next) => {
  try {
    const filter =
      req.user.role === ROLES.ADMIN
        ? { role: ROLES.USER }
        : {};

    const users = await User.find(filter)
      .select('-passwordHash')
      .populate('groupId', 'name')
      .populate('dispatchBoardId', 'name boardNumber')
      .sort({ createdAt: -1 });

    res.json({ users: users.map(formatUser) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      groupId,
      isRecruiter,
      isRecruitingManager,
      isDispatcher,
      isDispatchTeamLeader,
      isDispatchManager,
      isSafety,
      isSafetyManager,
      dispatchBoardId,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: EMAIL_INVALID_MESSAGE });
    }

    const assignedRole = role || ROLES.USER;

    if (assignedRole === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Cannot create super admin via API' });
    }

    if (assignedRole === ROLES.ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Only super admin can create admins' });
    }

    if (assignedRole === ROLES.USER && req.user.role === ROLES.ADMIN) {
      // ok
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(400).json({ message: 'Invalid group' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const createPayload = {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: assignedRole,
      groupId: groupId || null,
    };

    if (req.user.role === ROLES.SUPER_ADMIN) {
      if (isRecruiter !== undefined) createPayload.isRecruiter = Boolean(isRecruiter);
      if (isRecruitingManager !== undefined) {
        createPayload.isRecruitingManager = Boolean(isRecruitingManager);
      }
      if (isDispatcher !== undefined) createPayload.isDispatcher = Boolean(isDispatcher);
      if (isDispatchTeamLeader !== undefined) {
        createPayload.isDispatchTeamLeader = Boolean(isDispatchTeamLeader);
      }
      if (isDispatchManager !== undefined) {
        createPayload.isDispatchManager = Boolean(isDispatchManager);
      }
      if (isSafety !== undefined) createPayload.isSafety = Boolean(isSafety);
      if (isSafetyManager !== undefined) createPayload.isSafetyManager = Boolean(isSafetyManager);

      syncDispatchUserOnCreate(createPayload);
    }

    const user = await User.create(createPayload);

    if (req.user.role === ROLES.SUPER_ADMIN) {
      await applyDispatchUserFlags(user, {}, { dispatchBoardId: dispatchBoardId || null });
    }

    const populated = await User.findById(user._id)
      .select('-passwordHash')
      .populate('groupId', 'name')
      .populate('dispatchBoardId', 'name boardNumber');

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.USER_CREATE,
      category: AUDIT_CATEGORIES.USERS,
      targetType: TARGET_TYPES.USER,
      targetId: user._id,
      targetName: user.name,
      details: `${buildActorLabel(req.user)} created user ${user.name}`,
      newValues: { name: user.name, email: user.email, role: user.role, groupId: user.groupId },
      req,
    });

    res.status(201).json({ user: formatUser(populated) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!canManageTargetUser(req.user, target)) {
      return res.status(403).json({ message: 'Cannot manage this user' });
    }

    const {
      name,
      email,
      password,
      role,
      groupId,
      isRecruiter,
      isRecruitingManager,
      isDispatcher,
      isDispatchTeamLeader,
      isDispatchManager,
      isSafety,
      isSafetyManager,
      dispatchBoardId,
      replacementTeamLeaderUserId,
    } = req.body;
    const oldRole = target.role;
    const oldGroupId = target.groupId?.toString() || null;
    const oldValues = {
      name: target.name,
      email: target.email,
      role: target.role,
      groupId: oldGroupId,
    };

    if (name) target.name = name;
    if (email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: EMAIL_INVALID_MESSAGE });
      }
      target.email = email.toLowerCase();
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }
      target.passwordHash = await bcrypt.hash(password, 12);
    }

    if (role !== undefined) {
      if (role === ROLES.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Cannot assign super admin role' });
      }
      if (role === ROLES.ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Only super admin can manage admins' });
      }
      if (target.role === ROLES.ADMIN && req.user.role === ROLES.ADMIN) {
        return res.status(403).json({ message: 'Cannot modify admin users' });
      }
      target.role = role;
    }

    if (groupId !== undefined) {
      if (groupId) {
        const group = await Group.findById(groupId);
        if (!group) {
          return res.status(400).json({ message: 'Invalid group' });
        }
      }
      target.groupId = groupId || null;
    }

    if (req.user.role === ROLES.SUPER_ADMIN) {
      if (isRecruiter !== undefined) target.isRecruiter = Boolean(isRecruiter);
      if (isRecruitingManager !== undefined) {
        target.isRecruitingManager = Boolean(isRecruitingManager);
      }
      if (isDispatcher !== undefined) target.isDispatcher = Boolean(isDispatcher);
      if (isDispatchTeamLeader !== undefined) {
        target.isDispatchTeamLeader = Boolean(isDispatchTeamLeader);
      }
      if (isDispatchManager !== undefined) {
        target.isDispatchManager = Boolean(isDispatchManager);
      }
      if (isSafety !== undefined) target.isSafety = Boolean(isSafety);
      if (isSafetyManager !== undefined) target.isSafetyManager = Boolean(isSafetyManager);

      await syncDispatchUserOnUpdate(target, {
        isDispatcher,
        isDispatchTeamLeader,
        isDispatchManager,
        isSafety,
        isSafetyManager,
        dispatchBoardId,
        replacementTeamLeaderUserId,
        name,
      });
    }

    await target.save();

    const newValues = {
      name: target.name,
      email: target.email,
      role: target.role,
      groupId: target.groupId?.toString() || null,
    };

    if (password) {
      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.PASSWORD_RESET,
        category: AUDIT_CATEGORIES.AUTH,
        targetType: TARGET_TYPES.USER,
        targetId: target._id,
        targetName: target.name,
        details: `${buildActorLabel(req.user)} reset password for user ${target.name}`,
        req,
      });
    }

    if (role !== undefined && role !== oldRole) {
      const roleLabels = { USER: 'User', ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin' };
      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.ROLE_CHANGE,
        category: AUDIT_CATEGORIES.PERMISSIONS,
        targetType: TARGET_TYPES.ROLE,
        targetId: target._id,
        targetName: target.name,
        details: `${buildActorLabel(req.user)} changed role of user ${target.name} from ${roleLabels[oldRole] || oldRole} to ${roleLabels[role] || role}`,
        oldValues: { role: oldRole },
        newValues: { role },
        req,
      });
    }

    if (groupId !== undefined && (target.groupId?.toString() || null) !== oldGroupId) {
      const oldGroup = oldGroupId ? await Group.findById(oldGroupId) : null;
      const newGroup = target.groupId ? await Group.findById(target.groupId) : null;
      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.PERMISSION_UPDATE,
        category: AUDIT_CATEGORIES.PERMISSIONS,
        targetType: TARGET_TYPES.USER,
        targetId: target._id,
        targetName: target.name,
        details: `${buildActorLabel(req.user)} changed group assignment for user ${target.name} from ${oldGroup?.name || 'None'} to ${newGroup?.name || 'None'}`,
        oldValues: { groupId: oldGroupId, groupName: oldGroup?.name || null },
        newValues: { groupId: target.groupId?.toString() || null, groupName: newGroup?.name || null },
        req,
      });
    }

    if (name || email) {
      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.USER_UPDATE,
        category: AUDIT_CATEGORIES.USERS,
        targetType: TARGET_TYPES.USER,
        targetId: target._id,
        targetName: target.name,
        details: `${buildActorLabel(req.user)} updated user ${target.name}`,
        oldValues,
        newValues,
        req,
      });
    }

    const populated = await User.findById(target._id)
      .select('-passwordHash')
      .populate('groupId', 'name')
      .populate('dispatchBoardId', 'name boardNumber');

    res.json({ user: formatUser(populated) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (target.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Cannot delete super admin' });
    }

    if (!canManageTargetUser(req.user, target)) {
      return res.status(403).json({ message: 'Cannot delete this user' });
    }

    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.USER_DELETE,
      category: AUDIT_CATEGORIES.USERS,
      targetType: TARGET_TYPES.USER,
      targetId: target._id,
      targetName: target.name,
      details: `${buildActorLabel(req.user)} deleted user ${target.name}`,
      req,
    });

    await User.deleteOne({ _id: target._id });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

function formatUser(user) {
  return formatUserResponse(user);
}

export default router;
