import { Router } from 'express';
import { Group } from '../models/Group.js';
import { Folder } from '../models/Folder.js';
import { ROLES, ALL_PERMISSIONS } from '../config/constants.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { getRootFolder } from '../services/aclService.js';
import { auditLog, buildActorLabel } from '../services/auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';

const router = Router();

router.use(authMiddleware);

router.get('/', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req, res, next) => {
  try {
    const groups = await Group.find()
      .populate('permissions.folderId', 'name isRoot')
      .populate('permissions.subfolderId', 'name');
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.get('/public', async (req, res, next) => {
  try {
    const groups = await Group.find().select('name _id');
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.post('/', roleMiddleware(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { name, permissions } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Group name required' });
    }

    const existing = await Group.findOne({ name: name.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Group already exists' });
    }

    const validated = await validatePermissions(permissions || []);
    const group = await Group.create({
      name: name.toLowerCase(),
      permissions: validated,
    });

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.GROUP_CREATE,
      category: AUDIT_CATEGORIES.GROUPS,
      targetType: TARGET_TYPES.GROUP,
      targetId: group._id,
      targetName: group.name,
      details: `${buildActorLabel(req.user)} created group ${group.name}`,
      newValues: { permissions: validated },
      req,
    });

    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const { name, permissions } = req.body;
    const oldName = group.name;
    const oldPermissions = JSON.parse(JSON.stringify(group.permissions || []));

    if (name !== undefined) {
      if (req.user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Only super admin can rename groups' });
      }
      group.name = name.toLowerCase();
    }

    if (permissions !== undefined) {
      if (req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      group.permissions = await validatePermissions(permissions);
    }

    await group.save();

    if (name !== undefined && name.toLowerCase() !== oldName) {
      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.GROUP_UPDATE,
        category: AUDIT_CATEGORIES.GROUPS,
        targetType: TARGET_TYPES.GROUP,
        targetId: group._id,
        targetName: group.name,
        details: `${buildActorLabel(req.user)} updated group ${oldName} to ${group.name}`,
        oldValues: { name: oldName },
        newValues: { name: group.name },
        req,
      });
    }

    if (permissions !== undefined) {
      const newPermissions = group.permissions;
      const oldActions = summarizePermissions(oldPermissions);
      const newActions = summarizePermissions(newPermissions);

      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.PERMISSION_UPDATE,
        category: AUDIT_CATEGORIES.PERMISSIONS,
        targetType: TARGET_TYPES.GROUP,
        targetId: group._id,
        targetName: group.name,
        details: `${buildActorLabel(req.user)} modified permissions for group ${group.name}`,
        oldValues: { permissions: oldActions },
        newValues: { permissions: newActions },
        req,
      });

      diffPermissions(req, group, oldPermissions, newPermissions);
    }
    const populated = await Group.findById(group._id)
      .populate('permissions.folderId', 'name isRoot')
      .populate('permissions.subfolderId', 'name');

    res.json({ group: populated });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', roleMiddleware(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const group = await Group.findByIdAndDelete(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.GROUP_DELETE,
      category: AUDIT_CATEGORIES.GROUPS,
      targetType: TARGET_TYPES.GROUP,
      targetId: group._id,
      targetName: group.name,
      details: `${buildActorLabel(req.user)} deleted group ${group.name}`,
      req,
    });

    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
});

async function validatePermissions(permissions) {
  const validated = [];
  const seen = new Set();

  for (const perm of permissions) {
    const folder = await Folder.findById(perm.folderId);
    if (!folder) {
      throw Object.assign(new Error(`Invalid folder: ${perm.folderId}`), { status: 400 });
    }

    if (perm.subfolderId) {
      const sub = await Folder.findById(perm.subfolderId);
      if (!sub) {
        throw Object.assign(new Error(`Invalid subfolder: ${perm.subfolderId}`), {
          status: 400,
        });
      }

      const subRoot = await getRootFolder(sub._id);
      if (!subRoot || subRoot._id.toString() !== folder._id.toString()) {
        throw Object.assign(
          new Error(`Subfolder ${perm.subfolderId} does not belong to root folder ${perm.folderId}`),
          { status: 400 }
        );
      }
    }

    const key = `${folder._id}_${perm.subfolderId || 'root'}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const actions = (perm.allowedActions || []).filter((a) =>
      ALL_PERMISSIONS.includes(a)
    );

    validated.push({
      folderId: folder._id,
      subfolderId: perm.subfolderId || null,
      allowedActions: actions,
      showContents: perm.showContents !== false,
    });
  }
  return validated;
}

function permKey(perm) {
  return `${perm.folderId}_${perm.subfolderId || 'root'}`;
}

function summarizePermissions(permissions) {
  return (permissions || []).map((p) => ({
    folderId: p.folderId?.toString?.() || p.folderId,
    subfolderId: p.subfolderId?.toString?.() || p.subfolderId || null,
    allowedActions: [...(p.allowedActions || [])].sort(),
    showContents: p.showContents !== false,
  }));
}

async function diffPermissions(req, group, oldPermissions, newPermissions) {
  const oldMap = new Map(oldPermissions.map((p) => [permKey(p), p]));
  const newMap = new Map(newPermissions.map((p) => [permKey(p), p]));

  for (const [key, newPerm] of newMap) {
    const oldPerm = oldMap.get(key);
    const oldActions = new Set(oldPerm?.allowedActions || []);
    const newActions = new Set(newPerm.allowedActions || []);

    for (const action of newActions) {
      if (!oldActions.has(action)) {
        await auditLog({
          user: req.user,
          action: AUDIT_ACTIONS.PERMISSION_ADD,
          category: AUDIT_CATEGORIES.PERMISSIONS,
          targetType: TARGET_TYPES.GROUP,
          targetId: group._id,
          targetName: group.name,
          details: `${buildActorLabel(req.user)} granted ${action} permission to ${group.name} group`,
          newValues: { action, folderId: newPerm.folderId, subfolderId: newPerm.subfolderId },
          req,
        });
      }
    }

    for (const action of oldActions) {
      if (!newActions.has(action)) {
        await auditLog({
          user: req.user,
          action: AUDIT_ACTIONS.PERMISSION_REMOVE,
          category: AUDIT_CATEGORIES.PERMISSIONS,
          targetType: TARGET_TYPES.GROUP,
          targetId: group._id,
          targetName: group.name,
          details: `${buildActorLabel(req.user)} removed ${action} permission from ${group.name} group`,
          oldValues: { action, folderId: oldPerm.folderId, subfolderId: oldPerm.subfolderId },
          req,
        });
      }
    }
  }

  for (const [key, oldPerm] of oldMap) {
    if (!newMap.has(key)) {
      const actions = (oldPerm.allowedActions || []).join(', ');
      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.PERMISSION_REMOVE,
        category: AUDIT_CATEGORIES.PERMISSIONS,
        targetType: TARGET_TYPES.GROUP,
        targetId: group._id,
        targetName: group.name,
        details: `${buildActorLabel(req.user)} removed permissions (${actions}) from ${group.name} group`,
        oldValues: summarizePermissions([oldPerm]),
        req,
      });
    }
  }
}

export default router;
