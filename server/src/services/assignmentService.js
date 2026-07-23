import { TruckAssignment } from '../models/TruckAssignment.js';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { User } from '../models/User.js';
import { formatAssignment } from '../utils/dispatchFormat.js';
import { filterBySearch } from './dispatchEntityHelpers.js';
import { DRIVER_TYPES } from '../config/dispatchConstants.js';

const ASSIGNMENT_POPULATE = [
  { path: 'truckId', select: 'truckNumber status type' },
  { path: 'driverId', select: 'name driverType status' },
  { path: 'coDriverId', select: 'name driverType status' },
  {
    path: 'dispatcherId',
    select: 'name email dispatchBoardId',
    populate: { path: 'dispatchBoardId', select: 'name boardNumber' },
  },
  { path: 'history.changedBy', select: 'name' },
  { path: 'history.driverId', select: 'name' },
  { path: 'history.coDriverId', select: 'name' },
  { path: 'history.dispatcherId', select: 'name' },
];

async function assertDriverAvailable(driverId, assignmentId, fieldLabel) {
  if (!driverId) return;

  const driver = await Driver.findById(driverId);
  if (!driver) {
    const err = new Error(`${fieldLabel} not found`);
    err.status = 404;
    throw err;
  }

  if (driver.status !== 'Active') {
    const err = new Error(`${fieldLabel} must be Active`);
    err.status = 400;
    throw err;
  }

  const conflict = await TruckAssignment.findOne({
    _id: { $ne: assignmentId },
    $or: [{ driverId }, { coDriverId: driverId }],
  });

  if (conflict) {
    const err = new Error(`${driver.name} is already assigned to another truck`);
    err.status = 409;
    throw err;
  }
}

async function assertDispatcherValid(dispatcherId) {
  if (!dispatcherId) return null;

  const dispatcher = await User.findById(dispatcherId);
  if (!dispatcher) {
    const err = new Error('Dispatcher not found');
    err.status = 404;
    throw err;
  }

  if (!dispatcher.isDispatcher) {
    const err = new Error('Selected user is not a dispatcher');
    err.status = 400;
    throw err;
  }

  if (!dispatcher.dispatchBoardId) {
    const err = new Error('Dispatcher must be assigned to a board first');
    err.status = 400;
    throw err;
  }

  return dispatcher;
}

function pushHistory(assignment, action, userId, fields = {}) {
  assignment.history.push({
    action,
    driverId: fields.driverId ?? assignment.driverId,
    coDriverId: fields.coDriverId ?? assignment.coDriverId,
    dispatcherId: fields.dispatcherId ?? assignment.dispatcherId,
    changedBy: userId,
    note: fields.note || '',
  });
}

export async function listAssignments({ search, truckId } = {}) {
  const filter = {};
  if (truckId) filter.truckId = truckId;

  let assignments = await TruckAssignment.find(filter)
    .populate(ASSIGNMENT_POPULATE)
    .sort({ updatedAt: -1 });

  assignments = assignments.filter((assignment) => assignment.truckId?.status === 'Active');

  assignments = filterBySearch(
    assignments.map((a) => formatAssignment(a)),
    search,
    (assignment) => [
      assignment.truckNumber,
      assignment.driverName,
      assignment.coDriverName,
      assignment.dispatcherName,
    ]
  );

  return assignments;
}

export async function getAssignmentByTruckId(truckId) {
  const assignment = await TruckAssignment.findOne({ truckId }).populate(ASSIGNMENT_POPULATE);
  if (!assignment) {
    const err = new Error('Assignment not found for this truck');
    err.status = 404;
    throw err;
  }
  return assignment;
}

export async function updateAssignment(truckId, payload, userId) {
  const truck = await Truck.findById(truckId);
  if (!truck) {
    const err = new Error('Truck not found');
    err.status = 404;
    throw err;
  }

  if (truck.status !== 'Active') {
    const err = new Error('Assignments are only available for Active trucks');
    err.status = 400;
    throw err;
  }

  let assignment = await TruckAssignment.findOne({ truckId });
  if (!assignment) {
    assignment = await TruckAssignment.create({ truckId, history: [] });
  }

  const driverId = payload.driverId !== undefined ? payload.driverId || null : assignment.driverId;
  let coDriverId =
    payload.coDriverId !== undefined ? payload.coDriverId || null : assignment.coDriverId;
  const dispatcherId =
    payload.dispatcherId !== undefined ? payload.dispatcherId || null : assignment.dispatcherId;

  if (driverId) {
    const driver = await Driver.findById(driverId);
    if (!driver) {
      const err = new Error('Driver not found');
      err.status = 404;
      throw err;
    }

    if (driver.driverType === DRIVER_TYPES[1]) {
      if (!coDriverId) {
        const err = new Error('Co-driver is required for Team drivers');
        err.status = 400;
        throw err;
      }
    } else {
      coDriverId = null;
    }
  } else {
    coDriverId = null;
  }

  if (coDriverId && coDriverId.toString() === driverId?.toString()) {
    const err = new Error('Driver and co-driver must be different people');
    err.status = 400;
    throw err;
  }

  await assertDriverAvailable(driverId, assignment._id, 'Driver');
  await assertDriverAvailable(coDriverId, assignment._id, 'Co-driver');
  await assertDispatcherValid(dispatcherId);

  const changes = [];

  if (driverId?.toString() !== assignment.driverId?.toString()) {
    changes.push('driver_assigned');
    pushHistory(assignment, 'driver_assigned', userId, {
      driverId,
      coDriverId,
      dispatcherId,
    });
    assignment.driverId = driverId;
    assignment.coDriverId = coDriverId;
  } else if (coDriverId?.toString() !== assignment.coDriverId?.toString()) {
    changes.push('co_driver_assigned');
    pushHistory(assignment, 'co_driver_assigned', userId, {
      driverId,
      coDriverId,
      dispatcherId,
    });
    assignment.coDriverId = coDriverId;
  }

  if (dispatcherId?.toString() !== assignment.dispatcherId?.toString()) {
    changes.push('dispatcher_assigned');
    pushHistory(assignment, 'dispatcher_assigned', userId, {
      driverId: assignment.driverId,
      coDriverId: assignment.coDriverId,
      dispatcherId,
    });
    assignment.dispatcherId = dispatcherId;
  }

  if (!changes.length && !assignment.history.length) {
    pushHistory(assignment, 'created', userId, {
      driverId,
      coDriverId,
      dispatcherId,
    });
  }

  await assignment.save();
  return getAssignmentByTruckId(truckId);
}

export function formatAssignmentResponse(assignment) {
  return formatAssignment(assignment);
}
