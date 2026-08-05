import { Router } from 'express';
import { User } from '../models/User.js';
import { Lead } from '../models/Lead.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireRecruitingAccess,
  requireRecruitingManager,
  canAccessRecruiterBoard,
  isRecruitingModuleUser,
  isOwnRecruiterBoard,
  isRecruiterReadOnlyBoard,
  canMutateLeadsOnBoard,
} from '../middleware/recruitingMiddleware.js';
import { recruiterBoardLabel } from '../utils/userFormat.js';
import leadRoutes from './leadRoutes.js';
import importRoutes from './importRoutes.js';
import sourceRoutes from './sourceRoutes.js';
import statusRoutes from './statusRoutes.js';
import oldLeadRoutes from './oldLeadRoutes.js';
import roundRobinRoutes from './roundRobinRoutes.js';

const router = Router();

router.use(authMiddleware);

async function buildRecruiterBoards() {
  const recruiters = await User.find({ isRecruiter: true }).select('name').sort({ name: 1 });
  return recruiters.map((recruiter) => ({
    userId: recruiter._id,
    label: recruiterBoardLabel(recruiter.name),
  }));
}

async function buildManagerBoards() {
  const recruiters = await User.find({ isRecruiter: true }).select('name').sort({ name: 1 });
  const boards = recruiters.map((recruiter) => ({
    userId: recruiter._id,
    label: recruiterBoardLabel(recruiter.name),
  }));

  const activeRecruiterIds = new Set(boards.map((board) => board.userId.toString()));
  const orphanAssigneeIds = await Lead.distinct('assignedRecruiter', { archived: false });

  const orphanIds = orphanAssigneeIds.filter((id) => !activeRecruiterIds.has(id.toString()));
  if (orphanIds.length) {
    const orphanUsers = await User.find({ _id: { $in: orphanIds } }).select('name').sort({ name: 1 });
    for (const user of orphanUsers) {
      boards.push({
        userId: user._id,
        label: `${recruiterBoardLabel(user.name)} (Inactive)`,
      });
    }
    boards.sort((a, b) => a.label.localeCompare(b.label));
  }

  return boards;
}

router.get('/boards', requireRecruitingAccess, async (req, res, next) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7879/ingest/afe47dc1-7518-4b22-8821-40057cec5169',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a0e42e'},body:JSON.stringify({sessionId:'a0e42e',location:'recruitingRoutes.js:boards:entry',message:'GET /boards handler reached',data:{userId:req.user._id.toString(),role:req.user.role,isRecruiter:Boolean(req.user.isRecruiter),isRecruitingManager:Boolean(req.user.isRecruitingManager)},timestamp:Date.now(),hypothesisId:'H3',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
    if (
      req.user.isRecruitingManager ||
      req.user.role === 'SUPER_ADMIN' ||
      isRecruitingModuleUser(req.user)
    ) {
      const boards = await buildManagerBoards();

      if (req.user.isRecruitingManager && req.user.isRecruiter) {
        const ownId = req.user._id.toString();
        const ownBoard = boards.find((board) => board.userId.toString() === ownId);
        const otherBoards = boards.filter((board) => board.userId.toString() !== ownId);
        return res.json({
          boards: ownBoard ? [ownBoard, ...otherBoards] : boards,
        });
      }

      return res.json({ boards });
    }

    if (req.user.isRecruiter) {
      const boards = await buildRecruiterBoards();
      const ownId = req.user._id.toString();
      const ownBoard = boards.find((board) => board.userId.toString() === ownId);
      const otherBoards = boards.filter((board) => board.userId.toString() !== ownId);
      return res.json({
        boards: ownBoard ? [ownBoard, ...otherBoards] : boards,
      });
    }

    return res.status(403).json({ message: 'Recruiting access required' });
  } catch (err) {
    next(err);
  }
});

router.get('/boards/:userId', requireRecruitingAccess, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!canAccessRecruiterBoard(req.user, userId)) {
      return res.status(403).json({ message: 'Access denied to this board' });
    }

    const boardOwner = await User.findById(userId).select('name isRecruiter');
    if (!boardOwner) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (!boardOwner.isRecruiter) {
      if (!req.user.isRecruitingManager && !isRecruitingModuleUser(req.user)) {
        return res.status(404).json({ message: 'Board not found' });
      }

      const hasActiveLeads = await Lead.exists({
        assignedRecruiter: userId,
        archived: false,
      });

      if (!hasActiveLeads) {
        return res.status(404).json({ message: 'Board not found' });
      }
    }

    res.json({
      board: {
        userId: boardOwner._id,
        label: boardOwner.isRecruiter
          ? recruiterBoardLabel(boardOwner.name)
          : `${recruiterBoardLabel(boardOwner.name)} (Inactive)`,
      },
      permissions: {
        isOwnBoard: isOwnRecruiterBoard(req.user, userId),
        readOnly: isRecruiterReadOnlyBoard(req.user, userId),
        canMutate: canMutateLeadsOnBoard(req.user, userId),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.use('/leads', leadRoutes);
router.use('/import', importRoutes);
router.use('/old-leads', oldLeadRoutes);
router.use('/sources', sourceRoutes);
router.use('/statuses', statusRoutes);
router.use('/round-robin', roundRobinRoutes);

export default router;
