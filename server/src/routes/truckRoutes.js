import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireDispatchSafetyView } from '../middleware/dispatchMiddleware.js';
import {
  listTrucks,
  getTruckById,
  createTruck,
  updateTruck,
  deleteTruck,
  linkTruckFolder,
  formatTruckResponse,
} from '../services/truckService.js';
import {
  requireSafetyEdit,
  requireSafetyDelete,
  requireFolderLinkAccess,
} from '../middleware/dispatchMiddleware.js';
import { canEditSafetyEntities } from '../utils/dispatchPermissions.js';
import {
  auditTruckCreated,
  auditTruckUpdated,
  auditTruckDeleted,
} from '../services/dispatchAuditService.js';
import { createUploadFileFilter } from '../config/uploadTypes.js';
import { importTrucksFromBuffer } from '../services/equipmentSpreadsheetImportService.js';

const router = Router();

const equipmentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: createUploadFileFilter(),
});

router.use(authMiddleware);
router.use(requireDispatchSafetyView);

function pickTruckSnapshot(truck) {
  return {
    truckNumber: truck.truckNumber,
    type: truck.type,
    status: truck.status,
    make: truck.make,
    model: truck.model,
    year: truck.year,
    vin: truck.vin,
    plateNumber: truck.plateNumber,
    linkedFolderId: truck.linkedFolderId?.toString?.() || truck.linkedFolderId,
  };
}

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

router.post('/', requireSafetyEdit, async (req, res, next) => {
  try {
    const truck = await createTruck(req.body, req.user._id, req.user);
    await auditTruckCreated({ user: req.user, truck, req });
    res.status(201).json({ truck: formatTruckResponse(truck) });
  } catch (err) {
    next(err);
  }
});

router.post('/import', requireSafetyEdit, (req, res, next) => {
  equipmentImportUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return next(uploadErr);
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ message: 'File is required (CSV or Excel)' });
      }
      const result = await importTrucksFromBuffer(req.file.buffer, req.user);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });
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

router.put('/:id', requireSafetyEdit, async (req, res, next) => {
  try {
    const before = await getTruckById(req.params.id);
    const oldValues = pickTruckSnapshot(before);
    const truck = await updateTruck(req.params.id, req.body, req.user);
    await auditTruckUpdated({
      user: req.user,
      truck,
      req,
      oldValues,
      newValues: pickTruckSnapshot(truck),
    });
    res.json({ truck: formatTruckResponse(truck) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/folder', requireFolderLinkAccess, async (req, res, next) => {
  try {
    const truck = await linkTruckFolder(req.params.id, req.body.linkedFolderId ?? null, req.user, req);
    res.json({ truck: formatTruckResponse(truck) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireSafetyDelete, async (req, res, next) => {
  try {
    const truck = await getTruckById(req.params.id);
    const result = await deleteTruck(req.params.id);
    await auditTruckDeleted({ user: req.user, truck, req });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
