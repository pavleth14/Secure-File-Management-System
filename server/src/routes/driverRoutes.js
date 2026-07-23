import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireDispatchSafetyView,
  requireSafetyEdit,
  requireSafetyDelete,
  requireFolderLinkAccess,
} from '../middleware/dispatchMiddleware.js';
import {
  listDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  linkDriverFolder,
  formatDriverResponse,
} from '../services/driverService.js';
import { canEditSafetyEntities } from '../utils/dispatchPermissions.js';
import {
  auditDriverCreated,
  auditDriverUpdated,
  auditDriverDeleted,
} from '../services/dispatchAuditService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireDispatchSafetyView);

function pickDriverSnapshot(driver) {
  return {
    name: driver.name,
    driverType: driver.driverType,
    status: driver.status,
    phone: driver.phone,
    email: driver.email,
    linkedFolderId: driver.linkedFolderId?.toString?.() || driver.linkedFolderId,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const drivers = await listDrivers({
      search: req.query.search,
      status: req.query.status,
      user: req.user,
    });
    res.json({ drivers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const driver = await getDriverById(req.params.id);
    res.json({
      driver: formatDriverResponse(driver, { includeSsn: canEditSafetyEntities(req.user) }),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireSafetyEdit, async (req, res, next) => {
  try {
    const driver = await createDriver(req.body, req.user._id, req.user);
    await auditDriverCreated({ user: req.user, driver, req });
    res.status(201).json({
      driver: formatDriverResponse(driver, { includeSsn: true }),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireSafetyEdit, async (req, res, next) => {
  try {
    const before = await getDriverById(req.params.id);
    const oldValues = pickDriverSnapshot(before);
    const driver = await updateDriver(req.params.id, req.body, req.user);
    await auditDriverUpdated({
      user: req.user,
      driver,
      req,
      oldValues,
      newValues: pickDriverSnapshot(driver),
    });
    res.json({
      driver: formatDriverResponse(driver, { includeSsn: true }),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/folder', requireFolderLinkAccess, async (req, res, next) => {
  try {
    const driver = await linkDriverFolder(
      req.params.id,
      req.body.linkedFolderId ?? null,
      req.user,
      req
    );
    res.json({
      driver: formatDriverResponse(driver, { includeSsn: true }),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireSafetyDelete, async (req, res, next) => {
  try {
    const driver = await getDriverById(req.params.id);
    const result = await deleteDriver(req.params.id);
    await auditDriverDeleted({ user: req.user, driver, req });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
