import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireDispatchSafetyView,
  requireDispatchBoardManagement,
  requireDispatchModuleAccess,
} from '../middleware/dispatchMiddleware.js';
import {
  listDispatchBoards,
  listDispatchersForAssignments,
  assignDispatcherToBoard,
} from '../services/boardService.js';
import { getDispatchBoardGrid } from '../services/dispatchBoardGridService.js';
import { Driver } from '../models/Driver.js';
import { DRIVER_TYPES, EQUIPMENT_STATUSES } from '../config/dispatchConstants.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requireDispatchSafetyView, async (_req, res, next) => {
  try {
    const boards = await listDispatchBoards();
    res.json({ boards });
  } catch (err) {
    next(err);
  }
});

router.get('/:boardKey/grid', requireDispatchModuleAccess, async (req, res, next) => {
  try {
    const grid = await getDispatchBoardGrid(req.params.boardKey, req.query.weekStart);
    res.json(grid);
  } catch (err) {
    next(err);
  }
});

router.get('/dispatchers', requireDispatchSafetyView, async (_req, res, next) => {
  try {
    const dispatchers = await listDispatchersForAssignments();
    res.json({ dispatchers });
  } catch (err) {
    next(err);
  }
});

router.get('/active-drivers', requireDispatchSafetyView, async (_req, res, next) => {
  try {
    const drivers = await Driver.find({ status: EQUIPMENT_STATUSES[0] })
      .select('name driverType status')
      .sort({ name: 1 });
    res.json({
      drivers: drivers.map((driver) => ({
        id: driver._id,
        name: driver.name,
        driverType: driver.driverType,
        isTeam: driver.driverType === DRIVER_TYPES[1],
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/dispatchers/:userId/board',
  requireDispatchBoardManagement,
  async (req, res, next) => {
    try {
      const dispatcher = await assignDispatcherToBoard(req.params.userId, req.body.boardId || null);
      res.json({
        dispatcher: {
          id: dispatcher._id,
          name: dispatcher.name,
          dispatchBoardId: dispatcher.dispatchBoardId,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
