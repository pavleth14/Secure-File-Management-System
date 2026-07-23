import { Load } from '../models/Load.js';
import { DispatchState } from '../models/DispatchState.js';
import { Truck } from '../models/Truck.js';
import { Trailer } from '../models/Trailer.js';
import { Driver } from '../models/Driver.js';
import { TruckAssignment } from '../models/TruckAssignment.js';
import {
  LOAD_STATUSES,
  MAX_LOAD_COMMENT_LENGTH,
  LOAD_COMMENT_EDIT_WINDOW_MS,
} from '../config/dispatchConstants.js';
import { parseChicagoDateTime, formatChicagoDateTime, formatChicagoDisplay } from '../utils/chicagoTime.js';
import { filterBySearch } from './dispatchEntityHelpers.js';
import {
  canCreateOrEditLoads,
  canArchiveLoads,
  canMarkLoadActiveOrDone,
  getUserId,
} from '../utils/dispatchPermissions.js';

const LOAD_POPULATE = [
  { path: 'truckId', select: 'truckNumber status' },
  { path: 'trailerId', select: 'trailerNumber status' },
  { path: 'driverId', select: 'name driverType' },
  { path: 'coDriverId', select: 'name driverType' },
  { path: 'createdBy', select: 'name' },
  { path: 'archivedBy', select: 'name' },
  { path: 'comments.author', select: 'name' },
  { path: 'assignmentHistory.truckId', select: 'truckNumber' },
  { path: 'assignmentHistory.trailerId', select: 'trailerNumber' },
  { path: 'assignmentHistory.driverId', select: 'name' },
  { path: 'assignmentHistory.coDriverId', select: 'name' },
  { path: 'assignmentHistory.changedBy', select: 'name' },
];

const LOAD_SEARCH_FIELDS = [
  'loadNumber',
  'customer',
  'contact',
  'customerLoadNumber',
];

export function isWithinLoadCommentEditWindow(comment) {
  const createdAt =
    comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt);
  return Date.now() - createdAt.getTime() <= LOAD_COMMENT_EDIT_WINDOW_MS;
}

function formatStop(stop) {
  const { date, time } = formatChicagoDateTime(stop.scheduledAt);
  return {
    id: stop._id,
    order: stop.order,
    date,
    time,
    scheduledAt: stop.scheduledAt,
    address: stop.address,
    city: stop.city,
    state: stop.state,
  };
}

function formatComment(comment) {
  const authorDoc = comment.author;
  return {
    id: comment._id,
    text: comment.text,
    author: authorDoc?.name || 'Unknown',
    authorId: authorDoc?._id || comment.author,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    canEdit: false,
  };
}

export function formatLoadBoardLabel(load) {
  const pickups = [...(load.pickups || [])].sort((a, b) => a.order - b.order);
  const deliveries = [...(load.deliveries || [])].sort((a, b) => a.order - b.order);
  const firstPickup = pickups[0];
  const lastDelivery = deliveries[deliveries.length - 1];
  if (!firstPickup || !lastDelivery) return '';
  return `${firstPickup.city}, ${firstPickup.state} > ${lastDelivery.city}, ${lastDelivery.state}`;
}

export function formatLoad(load, { user } = {}) {
  const obj = load.toObject ? load.toObject() : load;
  const pickups = [...(obj.pickups || [])].sort((a, b) => a.order - b.order).map(formatStop);
  const deliveries = [...(obj.deliveries || [])].sort((a, b) => a.order - b.order).map(formatStop);

  const driver = obj.driverId;
  const coDriver = obj.coDriverId;
  const driverLabel = coDriver?.name ? `${driver?.name || ''} / ${coDriver.name}` : driver?.name || '';

  return {
    id: obj._id,
    loadNumber: obj.loadNumber,
    customer: obj.customer,
    contact: obj.contact,
    customerLoadNumber: obj.customerLoadNumber,
    invoiceAmount: obj.invoiceAmount,
    pickups,
    deliveries,
    truckId: obj.truckId?._id || obj.truckId || null,
    truckNumber: obj.truckId?.truckNumber || null,
    trailerId: obj.trailerId?._id || obj.trailerId || null,
    trailerNumber: obj.trailerId?.trailerNumber || null,
    driverId: driver?._id || driver || null,
    driverName: driver?.name || null,
    coDriverId: coDriver?._id || coDriver || null,
    coDriverName: coDriver?.name || null,
    driverLabel,
    loadedMiles: obj.loadedMiles,
    emptyMiles: obj.emptyMiles,
    status: obj.status,
    isActive: Boolean(obj.isActive),
    archived: Boolean(obj.archived),
    archivedAt: obj.archivedAt,
    archivedByName: obj.archivedBy?.name || null,
    deliveredAt: obj.deliveredAt,
    boardLabel: formatLoadBoardLabel(obj),
    assignmentHistory: (obj.assignmentHistory || []).map((entry) => ({
      id: entry._id,
      truckId: entry.truckId?._id || entry.truckId || null,
      truckNumber: entry.truckId?.truckNumber || null,
      trailerId: entry.trailerId?._id || entry.trailerId || null,
      trailerNumber: entry.trailerId?.trailerNumber || null,
      driverId: entry.driverId?._id || entry.driverId || null,
      driverName: entry.driverId?.name || null,
      coDriverId: entry.coDriverId?._id || entry.coDriverId || null,
      coDriverName: entry.coDriverId?.name || null,
      changedByName: entry.changedBy?.name || null,
      note: entry.note || '',
      createdAt: entry.createdAt,
    })),
    comments: (obj.comments || []).map((comment) => {
      const formatted = formatComment(comment);
      const authorId = comment.author?._id?.toString() || comment.author?.toString();
      formatted.canEdit =
        Boolean(user) &&
        authorId === getUserId(user)?.toString() &&
        isWithinLoadCommentEditWindow(comment);
      return formatted;
    }),
    createdByName: obj.createdBy?.name || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

async function getNextLoadNumber() {
  const state = await DispatchState.findOneAndUpdate(
    { key: 'load_counter' },
    { $inc: { lastLoadNumber: 1 } },
    { upsert: true, new: true }
  );
  return state.lastLoadNumber;
}

function normalizeStops(stops, label) {
  if (!Array.isArray(stops) || stops.length === 0) {
    const err = new Error(`At least one ${label} is required`);
    err.status = 400;
    throw err;
  }

  return stops.map((stop, index) => {
    const address = String(stop.address || '').trim();
    const city = String(stop.city || '').trim();
    const state = String(stop.state || '').trim();

    if (!address || !city || !state) {
      const err = new Error(`${label} ${index + 1}: address, city, and state are required`);
      err.status = 400;
      throw err;
    }

    return {
      order: index + 1,
      scheduledAt: parseChicagoDateTime(stop.date, stop.time),
      address,
      city,
      state,
    };
  });
}

function getLoadDateRange(load) {
  const dates = [
    ...(load.pickups || []).map((stop) => stop.scheduledAt),
    ...(load.deliveries || []).map((stop) => stop.scheduledAt),
  ]
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (!dates.length) return { start: null, end: null };
  return {
    start: new Date(Math.min(...dates.map((d) => d.getTime()))),
    end: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
}

function rangesOverlap(a, b) {
  if (!a.start || !a.end || !b.start || !b.end) return false;
  return a.start <= b.end && b.start <= a.end;
}

async function assertNoOverlap(loadData, excludeLoadId = null) {
  const range = getLoadDateRange(loadData);
  if (!range.start || !range.end) return;

  const filter = {
    archived: false,
    status: { $ne: 'delivered' },
  };
  if (excludeLoadId) filter._id = { $ne: excludeLoadId };

  const existingLoads = await Load.find(filter).select(
    'loadNumber truckId trailerId driverId coDriverId pickups deliveries'
  );

  const resourceIds = [
    ['truckId', loadData.truckId?.toString()],
    ['trailerId', loadData.trailerId?.toString()],
    ['driverId', loadData.driverId?.toString()],
  ];
  if (loadData.coDriverId) {
    resourceIds.push(['coDriverId', loadData.coDriverId.toString()]);
  }

  for (const existing of existingLoads) {
    const existingRange = getLoadDateRange(existing);
    if (!rangesOverlap(range, existingRange)) continue;

    for (const [field, id] of resourceIds) {
      if (!id) continue;
      const existingId = existing[field]?.toString();
      if (existingId === id) {
        const err = new Error(
          `Load #${existing.loadNumber} already uses the same ${field.replace('Id', '')} during overlapping dates`
        );
        err.status = 409;
        throw err;
      }
    }

    if (loadData.driverId && existing.coDriverId?.toString() === loadData.driverId.toString()) {
      const err = new Error(`Driver is already assigned on overlapping Load #${existing.loadNumber}`);
      err.status = 409;
      throw err;
    }
    if (loadData.coDriverId) {
      if (existing.driverId?.toString() === loadData.coDriverId.toString()) {
        const err = new Error(`Co-driver is already assigned on overlapping Load #${existing.loadNumber}`);
        err.status = 409;
        throw err;
      }
      if (existing.coDriverId?.toString() === loadData.coDriverId.toString()) {
        const err = new Error(`Co-driver is already assigned on overlapping Load #${existing.loadNumber}`);
        err.status = 409;
        throw err;
      }
    }
  }
}

async function validateLoadReferences(payload) {
  const truck = await Truck.findById(payload.truckId);
  if (!truck || truck.status !== 'Active') {
    const err = new Error('Active truck is required');
    err.status = 400;
    throw err;
  }

  const trailer = await Trailer.findById(payload.trailerId);
  if (!trailer || trailer.status !== 'Active') {
    const err = new Error('Active trailer is required');
    err.status = 400;
    throw err;
  }

  const driver = await Driver.findById(payload.driverId);
  if (!driver || driver.status !== 'Active') {
    const err = new Error('Active driver is required');
    err.status = 400;
    throw err;
  }

  let coDriverId = payload.coDriverId || null;
  if (driver.driverType === 'Team') {
    if (!coDriverId) {
      const err = new Error('Co-driver is required for team drivers');
      err.status = 400;
      throw err;
    }
    const coDriver = await Driver.findById(coDriverId);
    if (!coDriver || coDriver.status !== 'Active') {
      const err = new Error('Active co-driver is required');
      err.status = 400;
      throw err;
    }
  } else {
    coDriverId = null;
  }

  return { truck, trailer, driver, coDriverId };
}

function validateRequiredFields(payload) {
  const customer = String(payload.customer || '').trim();
  const contact = String(payload.contact || '').trim();
  const customerLoadNumber = String(payload.customerLoadNumber || '').trim();

  if (!customer || !contact || !customerLoadNumber) {
    const err = new Error('Customer, contact, and customer load # are required');
    err.status = 400;
    throw err;
  }

  const invoiceAmount = Number(payload.invoiceAmount);
  if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
    const err = new Error('Invoice amount must be a valid USD amount');
    err.status = 400;
    throw err;
  }

  const loadedMiles = Number(payload.loadedMiles);
  const emptyMiles = Number(payload.emptyMiles);
  if (!Number.isFinite(loadedMiles) || loadedMiles < 0 || !Number.isFinite(emptyMiles) || emptyMiles < 0) {
    const err = new Error('Loaded miles and empty miles are required');
    err.status = 400;
    throw err;
  }

  if (!payload.truckId || !payload.trailerId || !payload.driverId) {
    const err = new Error('Truck, trailer, and driver are required');
    err.status = 400;
    throw err;
  }

  return {
    customer,
    contact,
    customerLoadNumber,
    invoiceAmount,
    loadedMiles,
    emptyMiles,
    pickups: normalizeStops(payload.pickups, 'pickup'),
    deliveries: normalizeStops(payload.deliveries, 'delivery'),
  };
}

async function autoFillDriversFromAssignment(truckId, payload) {
  const assignment = await TruckAssignment.findOne({ truckId }).populate('driverId coDriverId');
  if (!assignment?.driverId) return payload;

  return {
    ...payload,
    driverId: payload.driverId || assignment.driverId._id,
    coDriverId: payload.coDriverId || assignment.coDriverId?._id || null,
  };
}

function trackAssignmentChanges(load, nextValues, userId) {
  const fields = ['truckId', 'trailerId', 'driverId', 'coDriverId'];
  const changed = fields.some(
    (field) => nextValues[field]?.toString() !== load[field]?.toString()
  );

  if (!changed) return;

  load.assignmentHistory.push({
    truckId: nextValues.truckId,
    trailerId: nextValues.trailerId,
    driverId: nextValues.driverId,
    coDriverId: nextValues.coDriverId || null,
    changedBy: userId,
    note: 'Resource assignment updated',
  });
}

export async function getLoadById(id) {
  const load = await Load.findById(id).populate(LOAD_POPULATE);
  if (!load) {
    const err = new Error('Load not found');
    err.status = 404;
    throw err;
  }
  return load;
}

export async function listLoads({ search, status, user } = {}) {
  const filter = { archived: false };
  if (status && status !== 'all' && LOAD_STATUSES.includes(status)) {
    filter.status = status;
  }

  let loads = await Load.find(filter).populate(LOAD_POPULATE).sort({ loadNumber: -1 });
  loads = filterBySearch(
    loads.map((load) => formatLoad(load, { user })),
    search,
    (load) => [
      load.loadNumber,
      load.customer,
      load.contact,
      load.customerLoadNumber,
      load.truckNumber,
      load.trailerNumber,
      load.driverLabel,
      load.boardLabel,
    ]
  );

  return loads;
}

export async function listArchivedLoads({ search, user } = {}) {
  let loads = await Load.find({ archived: true })
    .populate(LOAD_POPULATE)
    .sort({ archivedAt: -1 });

  loads = filterBySearch(
    loads.map((load) => formatLoad(load, { user })),
    search,
    (load) => [
      load.loadNumber,
      load.customer,
      load.contact,
      load.customerLoadNumber,
      load.truckNumber,
      load.boardLabel,
    ]
  );

  return loads;
}

export async function createLoad(payload, user) {
  if (!canCreateOrEditLoads(user)) {
    const err = new Error('Dispatch access required to create loads');
    err.status = 403;
    throw err;
  }

  let body = await autoFillDriversFromAssignment(payload.truckId, payload);
  const validated = validateRequiredFields(body);
  const { coDriverId } = await validateLoadReferences({ ...body, ...validated });

  const loadData = {
    ...validated,
    truckId: body.truckId,
    trailerId: body.trailerId,
    driverId: body.driverId,
    coDriverId,
  };

  await assertNoOverlap(loadData);

  const loadNumber = await getNextLoadNumber();
  const load = await Load.create({
    loadNumber,
    ...loadData,
    status: 'open',
    isActive: false,
    createdBy: user._id,
  });

  return getLoadById(load._id);
}

export async function updateLoad(id, payload, user) {
  if (!canCreateOrEditLoads(user)) {
    const err = new Error('Dispatch access required to edit loads');
    err.status = 403;
    throw err;
  }

  const load = await getLoadById(id);
  if (load.archived) {
    const err = new Error('Archived loads cannot be edited');
    err.status = 400;
    throw err;
  }

  let body = await autoFillDriversFromAssignment(payload.truckId || load.truckId, {
    ...load.toObject(),
    ...payload,
  });
  const validated = validateRequiredFields(body);
  const { coDriverId } = await validateLoadReferences({ ...body, ...validated });

  const nextValues = {
    ...validated,
    truckId: body.truckId,
    trailerId: body.trailerId,
    driverId: body.driverId,
    coDriverId,
  };

  await assertNoOverlap(nextValues, load._id);

  if (load.status === 'active' || load.isActive) {
    trackAssignmentChanges(load, nextValues, user._id);
  }

  Object.assign(load, nextValues);
  await load.save();
  return getLoadById(load._id);
}

export async function archiveLoad(id, user) {
  if (!canArchiveLoads(user)) {
    const err = new Error('Dispatch manager access required to archive loads');
    err.status = 403;
    throw err;
  }

  const load = await getLoadById(id);
  if (load.archived) {
    const err = new Error('Load is already archived');
    err.status = 400;
    throw err;
  }

  load.archived = true;
  load.archivedAt = new Date();
  load.archivedBy = user._id;
  load.isActive = false;
  if (load.status === 'active') load.status = 'open';
  await load.save();
  return getLoadById(load._id);
}

export async function markLoadActive(id, user) {
  const load = await getLoadById(id);
  if (!(await canMarkLoadActiveOrDone(user, load))) {
    const err = new Error('You cannot mark this load as active');
    err.status = 403;
    throw err;
  }

  if (load.archived || load.status === 'delivered') {
    const err = new Error('Delivered or archived loads cannot be marked active');
    err.status = 400;
    throw err;
  }

  await Load.updateMany(
    {
      _id: { $ne: load._id },
      truckId: load.truckId,
      isActive: true,
      archived: false,
    },
    { $set: { isActive: false, status: 'open' } }
  );

  load.isActive = true;
  load.status = 'active';
  await load.save();
  return getLoadById(load._id);
}

export async function markLoadDelivered(id, user) {
  const load = await getLoadById(id);
  if (!(await canMarkLoadActiveOrDone(user, load))) {
    const err = new Error('You cannot mark this load as delivered');
    err.status = 403;
    throw err;
  }

  if (load.archived) {
    const err = new Error('Archived loads cannot be updated');
    err.status = 400;
    throw err;
  }

  load.isActive = false;
  load.status = 'delivered';
  load.deliveredAt = new Date();
  await load.save();
  return getLoadById(load._id);
}

export async function addLoadComment(user, loadId, text) {
  const load = await getLoadById(loadId);
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const err = new Error('Comment text is required');
    err.status = 400;
    throw err;
  }
  if (trimmed.length > MAX_LOAD_COMMENT_LENGTH) {
    const err = new Error(`Comment must be ${MAX_LOAD_COMMENT_LENGTH} characters or fewer`);
    err.status = 400;
    throw err;
  }

  load.comments.push({ text: trimmed, author: user._id });
  await load.save();
  return getLoadById(load._id);
}

export async function editLoadComment(user, loadId, commentId, text) {
  const load = await getLoadById(loadId);
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const err = new Error('Comment text is required');
    err.status = 400;
    throw err;
  }

  const comment = load.comments.id(commentId);
  if (!comment) {
    const err = new Error('Comment not found');
    err.status = 404;
    throw err;
  }

  if (comment.author.toString() !== user._id.toString()) {
    const err = new Error('Only the comment author can edit this comment');
    err.status = 403;
    throw err;
  }

  if (!isWithinLoadCommentEditWindow(comment)) {
    const err = new Error('Comments can only be edited within 24 hours of creation');
    err.status = 403;
    throw err;
  }

  comment.text = trimmed;
  await load.save();
  return getLoadById(load._id);
}

export async function getLoadFormOptions() {
  const [trucks, trailers, assignments] = await Promise.all([
    Truck.find({ status: 'Active' }).select('truckNumber').sort({ truckNumber: 1 }),
    Trailer.find({ status: 'Active' }).select('trailerNumber').sort({ trailerNumber: 1 }),
    TruckAssignment.find()
      .populate('driverId', 'name driverType')
      .populate('coDriverId', 'name')
      .populate('dispatcherId', 'name')
      .populate('truckId', 'truckNumber'),
  ]);

  const assignmentByTruck = Object.fromEntries(
    assignments
      .filter((item) => item.truckId)
      .map((item) => [item.truckId._id.toString(), item])
  );

  return {
    trucks: trucks.map((truck) => ({
      id: truck._id,
      truckNumber: truck.truckNumber,
      assignment: assignmentByTruck[truck._id.toString()]
        ? {
            driverId: assignmentByTruck[truck._id.toString()].driverId?._id || null,
            driverName: assignmentByTruck[truck._id.toString()].driverId?.name || null,
            driverType: assignmentByTruck[truck._id.toString()].driverId?.driverType || null,
            coDriverId: assignmentByTruck[truck._id.toString()].coDriverId?._id || null,
            coDriverName: assignmentByTruck[truck._id.toString()].coDriverId?.name || null,
            dispatcherName: assignmentByTruck[truck._id.toString()].dispatcherId?.name || null,
          }
        : null,
    })),
    trailers: trailers.map((trailer) => ({
      id: trailer._id,
      trailerNumber: trailer.trailerNumber,
    })),
  };
}

export { formatChicagoDisplay };
