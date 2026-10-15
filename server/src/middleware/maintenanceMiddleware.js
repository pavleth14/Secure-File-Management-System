import {
  hasMaintenanceModuleAccess,
  canEditMaintenanceCases,
  canDeleteMaintenanceCases,
} from '../utils/maintenancePermissions.js';

export function requireMaintenanceAccess(req, res, next) {
  if (!hasMaintenanceModuleAccess(req.user)) {
    return res.status(403).json({ message: 'Maintenance access required' });
  }
  next();
}

export function requireMaintenanceEdit(req, res, next) {
  if (!canEditMaintenanceCases(req.user)) {
    return res.status(403).json({ message: 'Maintenance edit access required' });
  }
  next();
}

export function requireMaintenanceDelete(req, res, next) {
  if (!canDeleteMaintenanceCases(req.user)) {
    return res.status(403).json({ message: 'Only maintenance managers can delete cases' });
  }
  next();
}
