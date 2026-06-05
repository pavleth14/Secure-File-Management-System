import { Router } from 'express';
import fs from 'fs';
import path from 'path';
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
import { UPLOADS_BASE, resolveUploadDir } from '../config/multer.js';
import { getDescendantsFlat } from '../utils/folderTree.js';

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
          $or: [
            { folderId: folder._id },
            { subfolderId: folder._id },
          ],
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

      const folderName = name.trim();

      if (parentFolderId) {
        const parent = await Folder.findById(parentFolderId);
        if (!parent) {
          return res.status(404).json({ message: 'Parent folder not found' });
        }

        const root = await getRootFolder(parentFolderId);
        const subfolder = await Folder.create({
          name: folderName,
          parentFolderId,
          isRoot: false,
        });

        const dir = await resolveUploadDir(root._id, subfolder._id);
        fs.mkdirSync(dir, { recursive: true });

        return res.status(201).json({ folder: subfolder });
      }

      if (req.user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Only super admin can create root folders' });
      }

      const existing = await Folder.findOne({ name: folderName, isRoot: true });
      if (existing) {
        return res.status(409).json({ message: 'Root folder name already exists' });
      }

      const folder = await Folder.create({
        name: folderName,
        isRoot: true,
        parentFolderId: null,
      });

      fs.mkdirSync(path.join(UPLOADS_BASE, folderName), { recursive: true });
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

    const newName = name.trim();

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

      const oldPath = path.join(UPLOADS_BASE, folder.name);
      const newPath = path.join(UPLOADS_BASE, newName);
      if (folder.name !== newName && fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
      folder.name = newName;
      await folder.save();
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

    folder.name = newName;
    await folder.save();
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

      const dirPath = path.join(UPLOADS_BASE, folder.name);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }

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

    await Folder.deleteOne({ _id: folder._id });
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
