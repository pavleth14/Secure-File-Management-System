import { Router } from 'express';
import { Folder } from '../models/Folder.js';
import { FileModel } from '../models/File.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import {
  getAccessibleFolderIds,
  getUserPermissionsForFolder,
  getRootFolder,
  checkGroupPermission,
} from '../services/aclService.js';
import {
  sanitizeName,
  buildRelativePath,
  createFolderOnDisk,
  renameOnDisk,
  removeFromDisk,
  buildFolderRelativePath,
  updateRelativePathsAfterFolderRename,
} from '../services/storageService.js';
import { getDescendantsFlat } from '../utils/folderTree.js';
import { auditLog, buildActorLabel } from '../services/auditLogService.js';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, TARGET_TYPES } from '../config/auditConstants.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { parentId } = req.query;
    let query = {};

    if (parentId) {
      query = { parentFolderId: parentId };
      const parent = await Folder.findById(parentId);
      if (!parent) {
        return res.status(404).json({ message: 'Parent folder not found' });
      }

      const root = await getRootFolder(parentId);
      const check = await checkGroupPermission(
        req.user,
        root._id,
        PERMISSIONS.READ,
        parent.isRoot ? null : parentId
      );

      if (!check.allowed) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      const accessible = await getAccessibleFolderIds(req.user);
      query = { isRoot: true, _id: { $in: accessible } };
    }

    const folders = await Folder.find(query).sort({ name: 1 });

    const enriched = await Promise.all(
      folders.map(async (folder) => {
        const permissions = await getUserPermissionsForFolder(req.user, folder._id);
        return { ...folder.toObject(), permissions };
      })
    );

    res.json({ folders: enriched });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/tree', async (req, res, next) => {
  try {
    const root = await Folder.findById(req.params.id);
    if (!root) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const rootFolder = await getRootFolder(root._id);
    const check = await checkGroupPermission(
      req.user,
      rootFolder._id,
      PERMISSIONS.READ,
      root.isRoot ? null : root._id
    );

    if (!check.allowed) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const subfolders = await getDescendantsFlat(rootFolder._id);

    const enrichedSubfolders = await Promise.all(
      subfolders.map(async (folder) => {
        const fileCount = await FileModel.countDocuments({
          $or: [{ folderId: folder._id }, { subfolderId: folder._id }],
        });

        return {
          ...folder,
          hasFiles: fileCount > 0,
        };
      })
    );
    const permissions = await getUserPermissionsForFolder(req.user, rootFolder._id);

    res.json({
      root: { ...rootFolder.toObject(), permissions },
      subfolders: enrichedSubfolders,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const root = await getRootFolder(folder._id);
    const targetId = folder.isRoot ? folder._id : folder._id;

    const check = await checkGroupPermission(
      req.user,
      root._id,
      PERMISSIONS.READ,
      folder.isRoot ? null : targetId
    );

    if (!check.allowed) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const permissions = await getUserPermissionsForFolder(req.user, folder._id);
    const children = await Folder.find({ parentFolderId: folder._id }).sort({ name: 1 });

    res.json({
      folder: { ...folder.toObject(), permissions },
      children,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const { name, parentFolderId } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({ message: 'Folder name required' });
      }

      const folderName = sanitizeName(name.trim());

      if (parentFolderId) {
        const parent = await Folder.findById(parentFolderId);
        if (!parent) {
          return res.status(404).json({ message: 'Parent folder not found' });
        }

        const parentRelativePath =
          parent.relativePath || (await buildFolderRelativePath(parent._id));
        const relativePath = buildRelativePath(parentRelativePath, folderName);

        const subfolder = await Folder.create({
          name: folderName,
          relativePath,
          parentFolderId,
          isRoot: false,
        });

        await createFolderOnDisk(relativePath);

        await auditLog({
          user: req.user,
          action: AUDIT_ACTIONS.FOLDER_CREATE,
          category: AUDIT_CATEGORIES.FOLDERS,
          targetType: TARGET_TYPES.FOLDER,
          targetId: subfolder._id,
          targetName: subfolder.name,
          details: `${buildActorLabel(req.user)} created folder ${subfolder.name}`,
          req,
        });

        return res.status(201).json({ folder: subfolder });
      }

      if (req.user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Only super admin can create root folders' });
      }

      const existing = await Folder.findOne({ name: folderName, isRoot: true });
      if (existing) {
        return res.status(409).json({ message: 'Root folder name already exists' });
      }

      const relativePath = buildRelativePath(folderName);
      const folder = await Folder.create({
        name: folderName,
        relativePath,
        isRoot: true,
        parentFolderId: null,
      });

      await createFolderOnDisk(relativePath);

      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.FOLDER_CREATE,
        category: AUDIT_CATEGORIES.FOLDERS,
        targetType: TARGET_TYPES.FOLDER,
        targetId: folder._id,
        targetName: folder.name,
        details: `${buildActorLabel(req.user)} created folder ${folder.name}`,
        req,
      });

      res.status(201).json({ folder });
    } catch (err) {
      next(err);
    }
  }
);

router.put('/:id', async (req, res, next) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Folder name required' });
    }

    const newName = sanitizeName(name.trim());
    const oldName = folder.name;
    const oldRelativePath =
      folder.relativePath || (await buildFolderRelativePath(folder._id));

    if (folder.isRoot) {
      if (req.user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Only super admin can modify root folders' });
      }

      const duplicate = await Folder.findOne({
        name: newName,
        isRoot: true,
        _id: { $ne: folder._id },
      });
      if (duplicate) {
        return res.status(409).json({ message: 'Root folder name already exists' });
      }

      const newRelativePath = buildRelativePath(newName);
      if (oldRelativePath !== newRelativePath) {
        await renameOnDisk(oldRelativePath, newRelativePath);
        folder.name = newName;
        folder.relativePath = newRelativePath;
        await folder.save();
        await updateRelativePathsAfterFolderRename(
          folder._id,
          oldRelativePath,
          newRelativePath
        );
      }

      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.FOLDER_RENAME,
        category: AUDIT_CATEGORIES.FOLDERS,
        targetType: TARGET_TYPES.FOLDER,
        targetId: folder._id,
        targetName: newName,
        details: `${buildActorLabel(req.user)} renamed folder ${oldName} to ${newName}`,
        oldValues: { name: oldName },
        newValues: { name: newName },
        req,
      });

      return res.json({ folder });
    }

    const root = await getRootFolder(folder._id);
    const check = await checkGroupPermission(
      req.user,
      root._id,
      PERMISSIONS.EDIT,
      folder._id
    );

    if (!check.allowed && req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    const parentRelativePath = oldRelativePath.includes('/')
      ? oldRelativePath.slice(0, oldRelativePath.lastIndexOf('/'))
      : '';
    const newRelativePath = parentRelativePath
      ? buildRelativePath(parentRelativePath, newName)
      : buildRelativePath(newName);

    if (oldRelativePath !== newRelativePath) {
      await renameOnDisk(oldRelativePath, newRelativePath);
      folder.name = newName;
      folder.relativePath = newRelativePath;
      await folder.save();
      await updateRelativePathsAfterFolderRename(
        folder._id,
        oldRelativePath,
        newRelativePath
      );
    }

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.FOLDER_RENAME,
      category: AUDIT_CATEGORIES.FOLDERS,
      targetType: TARGET_TYPES.FOLDER,
      targetId: folder._id,
      targetName: newName,
      details: `${buildActorLabel(req.user)} renamed folder ${oldName} to ${newName}`,
      oldValues: { name: oldName },
      newValues: { name: newName },
      req,
    });

    res.json({ folder });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const folderRelativePath =
      folder.relativePath || (await buildFolderRelativePath(folder._id));

    if (folder.isRoot) {
      if (req.user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Only super admin can delete root folders' });
      }

      const descendants = await getDescendantsFlat(folder._id);
      if (descendants.length > 0) {
        return res.status(400).json({ message: 'Root folder has subfolders. Delete them first.' });
      }

      const fileCount = await FileModel.countDocuments({ folderId: folder._id });
      if (fileCount > 0) {
        return res.status(400).json({ message: 'Root folder contains files' });
      }

      await removeFromDisk(folderRelativePath, true);

      await auditLog({
        user: req.user,
        action: AUDIT_ACTIONS.FOLDER_DELETE,
        category: AUDIT_CATEGORIES.FOLDERS,
        targetType: TARGET_TYPES.FOLDER,
        targetId: folder._id,
        targetName: folder.name,
        details: `${buildActorLabel(req.user)} deleted folder ${folder.name}`,
        req,
      });

      await Folder.deleteOne({ _id: folder._id });
      return res.json({ message: 'Root folder deleted' });
    }

    const root = await getRootFolder(folder._id);
    const check = await checkGroupPermission(
      req.user,
      root._id,
      PERMISSIONS.DELETE,
      folder._id
    );

    if (!check.allowed && req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    const childCount = await Folder.countDocuments({ parentFolderId: folder._id });
    const fileCount = await FileModel.countDocuments({
      $or: [{ folderId: folder._id }, { subfolderId: folder._id }],
    });

    if (childCount > 0 || fileCount > 0) {
      return res.status(400).json({ message: 'Folder is not empty' });
    }

    await removeFromDisk(folderRelativePath, true);

    await auditLog({
      user: req.user,
      action: AUDIT_ACTIONS.FOLDER_DELETE,
      category: AUDIT_CATEGORIES.FOLDERS,
      targetType: TARGET_TYPES.FOLDER,
      targetId: folder._id,
      targetName: folder.name,
      details: `${buildActorLabel(req.user)} deleted folder ${folder.name}`,
      req,
    });

    await Folder.deleteOne({ _id: folder._id });
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
