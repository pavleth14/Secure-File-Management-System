import { DispatchBoard } from '../models/DispatchBoard.js';
import { User } from '../models/User.js';
import { formatBoard } from '../utils/dispatchFormat.js';

export async function getNextBoardNumber() {
  const last = await DispatchBoard.findOne().sort({ boardNumber: -1 }).select('boardNumber');
  return (last?.boardNumber || 0) + 1;
}

export function buildBoardName(boardNumber, teamLeaderName) {
  return `Board ${boardNumber} (${teamLeaderName})`;
}

export async function createBoardForTeamLeader(teamLeader) {
  const existing = await DispatchBoard.findOne({ teamLeaderId: teamLeader._id });
  if (existing) {
    return existing;
  }

  const boardNumber = await getNextBoardNumber();
  const board = await DispatchBoard.create({
    boardNumber,
    name: buildBoardName(boardNumber, teamLeader.name),
    teamLeaderId: teamLeader._id,
  });

  return board;
}

export async function updateBoardTeamLeaderName(teamLeader) {
  const board = await DispatchBoard.findOne({ teamLeaderId: teamLeader._id });
  if (!board) return null;

  board.name = buildBoardName(board.boardNumber, teamLeader.name);
  await board.save();
  return board;
}

export async function reassignBoardTeamLeader(boardId, newTeamLeaderId) {
  const board = await DispatchBoard.findById(boardId);
  if (!board) {
    const err = new Error('Board not found');
    err.status = 404;
    throw err;
  }

  const newLeader = await User.findById(newTeamLeaderId);
  if (!newLeader) {
    const err = new Error('New team leader not found');
    err.status = 404;
    throw err;
  }

  if (!newLeader.isDispatchTeamLeader) {
    const err = new Error('Replacement user must have Dispatch Team Leader role');
    err.status = 400;
    throw err;
  }

  const existingBoard = await DispatchBoard.findOne({
    teamLeaderId: newLeader._id,
    _id: { $ne: board._id },
  });
  if (existingBoard) {
    const err = new Error('User already leads another board');
    err.status = 409;
    throw err;
  }

  board.teamLeaderId = newLeader._id;
  board.name = buildBoardName(board.boardNumber, newLeader.name);
  await board.save();
  return board;
}

export async function listDispatchBoards() {
  const boards = await DispatchBoard.find()
    .populate('teamLeaderId', 'name email')
    .sort({ boardNumber: 1 });
  return boards.map(formatBoard);
}

export async function listDispatchersForAssignments() {
  const users = await User.find({
    isDispatcher: true,
    dispatchBoardId: { $ne: null },
  })
    .select('name email dispatchBoardId')
    .populate('dispatchBoardId', 'name boardNumber')
    .sort({ name: 1 });

  return users.map((user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    dispatchBoardId: user.dispatchBoardId?._id || user.dispatchBoardId || null,
    dispatchBoardName: user.dispatchBoardId?.name || null,
  }));
}

export async function assignDispatcherToBoard(dispatcherId, boardId) {
  const dispatcher = await User.findById(dispatcherId);
  if (!dispatcher) {
    const err = new Error('Dispatcher not found');
    err.status = 404;
    throw err;
  }

  if (!dispatcher.isDispatcher) {
    const err = new Error('User is not a dispatcher');
    err.status = 400;
    throw err;
  }

  if (boardId) {
    const board = await DispatchBoard.findById(boardId);
    if (!board) {
      const err = new Error('Board not found');
      err.status = 404;
      throw err;
    }
    dispatcher.dispatchBoardId = board._id;
  } else {
    dispatcher.dispatchBoardId = null;
  }

  await dispatcher.save();
  return dispatcher;
}
