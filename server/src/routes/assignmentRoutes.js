import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireDispatchSafetyView,
  requireAssignmentEdit,
} from '../middleware/dispatchMiddleware.js';
import {
  listAssignments,
  getAssignmentByTruckId,
  updateAssignment,
  formatAssignmentResponse,
} from '../services/assignmentService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireDispatchSafetyView);

router.get('/', async (req, res, next) => {
  try {
    const assignments = await listAssignments({
      search: req.query.search,
      truckId: req.query.truckId,
    });
    res.json({ assignments });
  } catch (err) {
    next(err);
  }
});

router.get('/truck/:truckId', async (req, res, next) => {
  try {
    const assignment = await getAssignmentByTruckId(req.params.truckId);
    res.json({ assignment: formatAssignmentResponse(assignment) });
  } catch (err) {
    next(err);
  }
});

router.put('/truck/:truckId', requireAssignmentEdit, async (req, res, next) => {
  try {
    const assignment = await updateAssignment(req.params.truckId, req.body, req.user._id);
    res.json({ assignment: formatAssignmentResponse(assignment) });
  } catch (err) {
    next(err);
  }
});

export default router;
