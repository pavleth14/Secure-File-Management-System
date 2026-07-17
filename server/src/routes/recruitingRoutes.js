import { Router } from 'express';
import { User } from '../models/User.js';
import { Lead } from '../models/Lead.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireRecruitingAccess,
  requireRecruitingManager,
  canAccessRecruiterBoard,
  isRecruitingModuleUser,
} from '../middleware/recruitingMiddleware.js';
import { recruiterBoardLabel } from '../utils/userFormat.js';
import leadRoutes from './leadRoutes.js';
import importRoutes from './importRoutes.js';
import sourceRoutes from './sourceRoutes.js';

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
    if (req.user.isRecruitingManager || isRecruitingModuleUser(req.user)) {
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
    });
  } catch (err) {
    next(err);
  }
});

router.use('/leads', leadRoutes);
router.use('/import', importRoutes);
router.use('/sources', sourceRoutes);

export default router;
