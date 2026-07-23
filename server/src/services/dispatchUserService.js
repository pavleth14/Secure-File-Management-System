import { User } from '../models/User.js';
import { DispatchBoard } from '../models/DispatchBoard.js';
import {
  createBoardForTeamLeader,
  updateBoardTeamLeaderName,
  reassignBoardTeamLeader,
  assignDispatcherToBoard,
} from './boardService.js';
import { validateDispatchRoleCombo } from '../utils/dispatchPermissions.js';

const DISPATCH_FLAGS = [
  'isDispatcher',
  'isDispatchTeamLeader',
  'isDispatchManager',
  'isSafety',
  'isSafetyManager',
];

export function extractDispatchFlags(body) {
  const flags = {};
  for (const key of DISPATCH_FLAGS) {
    if (body[key] !== undefined) {
      flags[key] = Boolean(body[key]);
    }
  }
  return flags;
}

export async function applyDispatchUserFlags(user, flags, options = {}) {
  const nextFlags = {
    isDispatcher: user.isDispatcher,
    isDispatchTeamLeader: user.isDispatchTeamLeader,
    isDispatchManager: user.isDispatchManager,
    isSafety: user.isSafety,
    isSafetyManager: user.isSafetyManager,
    ...flags,
  };

  validateDispatchRoleCombo(nextFlags);

  const wasTeamLeader = user.isDispatchTeamLeader;
  const willBeTeamLeader = nextFlags.isDispatchTeamLeader;

  if (wasTeamLeader && !willBeTeamLeader) {
    const board = await DispatchBoard.findOne({ teamLeaderId: user._id });
    if (board) {
      const replacementId = options.replacementTeamLeaderUserId;
      if (!replacementId) {
        const err = new Error(
          'Assign a replacement team leader before removing Dispatch Team Leader role'
        );
        err.status = 400;
        throw err;
      }
      await reassignBoardTeamLeader(board._id, replacementId);
    }
  }

  for (const key of DISPATCH_FLAGS) {
    if (flags[key] !== undefined) {
      user[key] = Boolean(flags[key]);
    }
  }

  if (options.dispatchBoardId !== undefined) {
    if (options.dispatchBoardId) {
      await assignDispatcherToBoard(user._id, options.dispatchBoardId);
    } else {
      user.dispatchBoardId = null;
    }
  }

  if (!user.isDispatcher) {
    user.dispatchBoardId = null;
  }

  await user.save();

  if (user.isDispatchTeamLeader) {
    await createBoardForTeamLeader(user);
    if (options.nameChanged) {
      await updateBoardTeamLeaderName(user);
    }
  }

  return user;
}

export async function syncDispatchUserOnUpdate(user, body) {
  const flags = extractDispatchFlags(body);
  const hasFlagChanges = Object.keys(flags).length > 0;
  const hasBoardChange = body.dispatchBoardId !== undefined;

  if (!hasFlagChanges && !hasBoardChange) {
    return user;
  }

  return applyDispatchUserFlags(user, flags, {
    replacementTeamLeaderUserId: body.replacementTeamLeaderUserId,
    dispatchBoardId: body.dispatchBoardId,
    nameChanged: Boolean(body.name),
  });
}

export async function syncDispatchUserOnCreate(payload) {
  const flags = extractDispatchFlags(payload);
  validateDispatchRoleCombo({
    isDispatcher: Boolean(flags.isDispatcher),
    isDispatchTeamLeader: Boolean(flags.isDispatchTeamLeader),
    isDispatchManager: Boolean(flags.isDispatchManager),
    isSafety: Boolean(flags.isSafety),
    isSafetyManager: Boolean(flags.isSafetyManager),
  });

  return flags;
}
