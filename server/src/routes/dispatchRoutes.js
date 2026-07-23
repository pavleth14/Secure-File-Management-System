import { Router } from 'express';
import truckRoutes from './truckRoutes.js';
import trailerRoutes from './trailerRoutes.js';
import driverRoutes from './driverRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import dispatchBoardRoutes from './dispatchBoardRoutes.js';
import loadRoutes from './loadRoutes.js';

const router = Router();

router.use('/boards', dispatchBoardRoutes);
router.use('/loads', loadRoutes);
router.use('/trucks', truckRoutes);
router.use('/trailers', trailerRoutes);
router.use('/drivers', driverRoutes);
router.use('/assignments', assignmentRoutes);

export default router;
