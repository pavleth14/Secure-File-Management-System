import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireDispatchSafetyView } from '../middleware/dispatchMiddleware.js';
import {
  listTrucks,
  getTruckById,
  createTruck,
  updateTruck,
  deleteTruck,
  formatTruckResponse,
} from '../services/truckService.js';
import {
  requireSafetyEdit,
  requireSafetyDelete,
} from '../middleware/dispatchMiddleware.js';
import { canEditSafetyEntities } from '../utils/dispatchPermissions.js';

const router = Router();

router.use(authMiddleware);
router.use(requireDispatchSafetyView);

router.get('/', async (req, res, next) => {
  try {
    const trucks = await listTrucks({
      search: req.query.search,
      status: req.query.status,
      user: req.user,
    });
    res.json({ trucks });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const truck = await getTruckById(req.params.id);
    res.json({
      truck: formatTruckResponse(truck, { includeSsn: canEditSafetyEntities(req.user) }),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireSafetyEdit, async (req, res, next) => {
  try {
    const truck = await createTruck(req.body, req.user._id);
    res.status(201).json({ truck: formatTruckResponse(truck) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireSafetyEdit, async (req, res, next) => {
  try {
    const truck = await updateTruck(req.params.id, req.body);
    res.json({ truck: formatTruckResponse(truck) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireSafetyDelete, async (req, res, next) => {
  try {
    const result = await deleteTruck(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
