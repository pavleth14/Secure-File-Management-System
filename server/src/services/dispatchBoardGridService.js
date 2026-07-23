import { DispatchBoard } from '../models/DispatchBoard.js';
import { TruckAssignment } from '../models/TruckAssignment.js';
import { Load } from '../models/Load.js';
import { formatLoadBoardLabel } from './loadService.js';
import {
  resolveWeekStart,
  buildWeekDays,
  addDaysToDateKey,
  buildHandoffDaySet,
  computeLoadBarPosition,
  getLoadBarColor,
  loadOverlapsWeek,
} from '../utils/dispatchWeek.js';

const ASSIGNMENT_POPULATE = [
  {
    path: 'truckId',
    select: 'truckNumber status',
  },
  {
    path: 'driverId',
    select: 'name driverType',
  },
  {
    path: 'coDriverId',
    select: 'name',
  },
  {
    path: 'dispatcherId',
    select: 'name dispatchBoardId',
    populate: { path: 'dispatchBoardId', select: 'name boardNumber' },
  },
];

const LOAD_POPULATE = [
  { path: 'trailerId', select: 'trailerNumber' },
  { path: 'driverId', select: 'name' },
  { path: 'coDriverId', select: 'name' },
];

function formatDriverLabel(assignment) {
  const driver = assignment.driverId;
  const coDriver = assignment.coDriverId;
  if (!driver?.name) return '—';
  if (coDriver?.name) return `${driver.name} / ${coDriver.name}`;
  return driver.name;
}

function resolveTrailerNumber(loads) {
  const activeLoad = loads.find((load) => load.isActive);
  if (activeLoad?.trailerId?.trailerNumber) {
    return activeLoad.trailerId.trailerNumber;
  }

  const openLoad = loads.find((load) => load.status !== 'delivered');
  if (openLoad?.trailerId?.trailerNumber) {
    return openLoad.trailerId.trailerNumber;
  }

  return '—';
}

async function getBoardMeta(boardKey) {
  if (boardKey === 'global') {
    return {
      id: 'global',
      name: 'Global Board',
      boardNumber: null,
      isGlobal: true,
    };
  }

  const board = await DispatchBoard.findById(boardKey).populate('teamLeaderId', 'name');
  if (!board) {
    const err = new Error('Board not found');
    err.status = 404;
    throw err;
  }

  return {
    id: board._id.toString(),
    name: board.name,
    boardNumber: board.boardNumber,
    teamLeaderId: board.teamLeaderId?._id?.toString() || null,
    teamLeaderName: board.teamLeaderId?.name || null,
    isGlobal: false,
  };
}

function assignmentMatchesBoard(assignment, boardKey) {
  if (!assignment.driverId || !assignment.dispatcherId) return false;
  if (assignment.truckId?.status !== 'Active') return false;

  const dispatcherBoardId =
    assignment.dispatcherId?.dispatchBoardId?._id?.toString() ||
    assignment.dispatcherId?.dispatchBoardId?.toString();

  if (!dispatcherBoardId) return false;

  if (boardKey === 'global') return true;
  return dispatcherBoardId === boardKey.toString();
}

export async function getDispatchBoardGrid(boardKey, weekStartParam) {
  const weekStart = resolveWeekStart(weekStartParam);
  const weekDays = buildWeekDays(weekStart);
  const board = await getBoardMeta(boardKey);

  const assignments = await TruckAssignment.find()
    .populate(ASSIGNMENT_POPULATE)
    .sort({ 'truckId.truckNumber': 1 });

  const visibleAssignments = assignments
    .filter((assignment) => assignmentMatchesBoard(assignment, boardKey))
    .sort((a, b) => {
      const aNum = a.truckId?.truckNumber || '';
      const bNum = b.truckId?.truckNumber || '';
      return aNum.localeCompare(bNum, undefined, { numeric: true });
    });

  const truckIds = visibleAssignments
    .map((assignment) => assignment.truckId?._id)
    .filter(Boolean);

  const loads = truckIds.length
    ? await Load.find({
        archived: false,
        truckId: { $in: truckIds },
      })
        .populate(LOAD_POPULATE)
        .sort({ loadNumber: 1 })
    : [];

  const loadsByTruck = loads.reduce((acc, load) => {
    const key = load.truckId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(load);
    return acc;
  }, {});

  const rows = visibleAssignments.map((assignment) => {
    const truckId = assignment.truckId._id.toString();
    const truckLoads = loadsByTruck[truckId] || [];
    const weekLoads = truckLoads.filter((load) => loadOverlapsWeek(load, weekDays));
    const handoffDays = buildHandoffDaySet(truckLoads);

    return {
      truckId,
      truckNumber: assignment.truckId.truckNumber,
      trailerNumber: resolveTrailerNumber(truckLoads),
      driverLabel: formatDriverLabel(assignment),
      dispatcherName: assignment.dispatcherId?.name || '—',
      loads: weekLoads
        .map((load) => {
          const bar = computeLoadBarPosition(load, weekDays, handoffDays, truckLoads);
          if (!bar) return null;

          return {
            id: load._id.toString(),
            loadNumber: load.loadNumber,
            label: formatLoadBoardLabel(load),
            color: getLoadBarColor(load),
            status: load.status,
            isActive: Boolean(load.isActive),
            leftPct: bar.leftPct,
            widthPct: bar.widthPct,
            commentCount: load.comments?.length || 0,
          };
        })
        .filter(Boolean),
    };
  });

  return {
    board,
    weekStart,
    weekEnd: addDaysToDateKey(weekStart, 6),
    days: weekDays,
    rows,
  };
}
