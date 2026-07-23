import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireDispatchSafetyView,
  requireSafetyEdit,
  requireSafetyDelete,
} from '../middleware/dispatchMiddleware.js';
import {
  listDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  formatDriverResponse,
} from '../services/driverService.js';
import { canEditSafetyEntities } from '../utils/dispatchPermissions.js';

const router = Router();

router.use(authMiddleware);
router.use(requireDispatchSafetyView);

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
    const driver = await createDriver(req.body, req.user._id);
    res.status(201).json({
      driver: formatDriverResponse(driver, { includeSsn: true }),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireSafetyEdit, async (req, res, next) => {
  try {
    const driver = await updateDriver(req.params.id, req.body);
    res.json({
      driver: formatDriverResponse(driver, { includeSsn: true }),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireSafetyDelete, async (req, res, next) => {
  try {
    const result = await deleteDriver(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
