import { checkGroupPermission } from '../services/aclService.js';
import { PERMISSIONS } from '../config/constants.js';

export function aclMiddleware(action, options = {}) {
  return async (req, res, next) => {
    try {
      const folderId =
        req.params.folderId ||
        req.params.id ||
        req.body.folderId ||
        req.query.folderId;

      const subfolderId =
        req.body.subfolderId || req.query.subfolderId || null;

      if (!folderId && !options.optionalFolder) {
        return res.status(400).json({ message: 'Folder context required' });
      }

      if (!folderId) {
        return next();
      }

      const result = await checkGroupPermission(
        req.user,
        folderId,
        action,
        subfolderId
      );

      if (!result.allowed) {
        return res.status(403).json({ message: result.message });
      }

      req.aclContext = result;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function aclFromFile(action) {
  return async (req, res, next) => {
    try {
      const { FileModel } = await import('../models/File.js');
      const file = await FileModel.findById(req.params.id);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }

      req.fileRecord = file;
      const targetFolder = file.subfolderId || file.folderId;

      const result = await checkGroupPermission(
        req.user,
        file.folderId,
        action,
        file.subfolderId ? targetFolder : null
      );

      if (!result.allowed) {
        return res.status(403).json({ message: result.message });
      }

      req.aclContext = result;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export { PERMISSIONS };
