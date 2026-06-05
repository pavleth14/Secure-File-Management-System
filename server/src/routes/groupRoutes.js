import { Router } from 'express';
import { Group } from '../models/Group.js';
import { Folder } from '../models/Folder.js';
import { ROLES, ALL_PERMISSIONS } from '../config/constants.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req, res, next) => {
  try {
    const groups = await Group.find().populate('permissions.folderId', 'name isRoot');
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
    const populated = await Group.findById(group._id).populate(
      'permissions.folderId',
      'name isRoot'
    );

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
    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
});

async function validatePermissions(permissions) {
  const validated = [];
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
    }

    const actions = (perm.allowedActions || []).filter((a) =>
      ALL_PERMISSIONS.includes(a)
    );

    validated.push({
      folderId: folder._id,
      subfolderId: perm.subfolderId || null,
      allowedActions: actions,
    });
  }
  return validated;
}

export default router;
