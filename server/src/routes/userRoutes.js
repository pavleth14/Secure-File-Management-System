import { Router } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { ROLES } from '../config/constants.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware, canManageTargetUser } from '../middleware/roleMiddleware.js';

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
      .sort({ createdAt: -1 });

    res.json({ users: users.map(formatUser) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role, groupId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password required' });
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
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: assignedRole,
      groupId: groupId || null,
    });

    const populated = await User.findById(user._id)
      .select('-passwordHash')
      .populate('groupId', 'name');

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

    const { name, email, password, role, groupId } = req.body;

    if (name) target.name = name;
    if (email) target.email = email.toLowerCase();

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

    await target.save();

    const populated = await User.findById(target._id)
      .select('-passwordHash')
      .populate('groupId', 'name');

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

    await User.deleteOne({ _id: target._id });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

function formatUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    groupId: user.groupId?._id || user.groupId || null,
    groupName: user.groupId?.name || null,
    createdAt: user.createdAt,
  };
}

export default router;
