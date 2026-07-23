import { Truck } from '../models/Truck.js';
import { TruckAssignment } from '../models/TruckAssignment.js';
import { formatTruck } from '../utils/dispatchFormat.js';
import {
  filterBySearch,
  filterByStatus,
  parseDateInput,
  assertFolderExists,
} from './dispatchEntityHelpers.js';
import { EQUIPMENT_STATUSES } from '../config/dispatchConstants.js';
import { canEditSafetyEntities } from '../utils/dispatchPermissions.js';

const TRUCK_SEARCH_FIELDS = [
  'truckNumber',
  'type',
  'status',
  'make',
  'model',
  'year',
  'vin',
  'plateNumber',
  'notes',
];

function validateTruckPayload(payload, { isUpdate = false } = {}) {
  const truckNumber = String(payload.truckNumber || '').trim();
  if (!isUpdate && !truckNumber) {
    const err = new Error('Truck# is required');
    err.status = 400;
    throw err;
  }

  if (payload.status && !EQUIPMENT_STATUSES.includes(payload.status)) {
    const err = new Error('Invalid truck status');
    err.status = 400;
    throw err;
  }

  return {
    truckNumber,
    type: String(payload.type || '').trim(),
    status: payload.status || 'Active',
    make: String(payload.make || '').trim(),
    model: String(payload.model || '').trim(),
    year: String(payload.year || '').trim(),
    vin: String(payload.vin || '').trim(),
    plateNumber: String(payload.plateNumber || '').trim(),
    dotInspectionExpiration: parseDateInput(payload.dotInspectionExpiration),
    platesExpiration: parseDateInput(payload.platesExpiration),
    notes: String(payload.notes || '').trim(),
    linkedFolderId: payload.linkedFolderId || null,
  };
}

export async function listTrucks({ search, status, user } = {}) {
  let trucks = await Truck.find()
    .populate('linkedFolderId', 'name relativePath')
    .sort({ truckNumber: 1 });

  trucks = trucks.map((t) => t.toObject());

  if (!canEditSafetyEntities(user) && (!status || status === 'all')) {
    trucks = trucks.filter((truck) => truck.status === 'Active');
  }

  trucks = filterByStatus(trucks, status);
  trucks = filterBySearch(trucks, search, (truck) =>
    TRUCK_SEARCH_FIELDS.map((field) => truck[field])
  );

  return trucks.map((truck) => formatTruck(truck));
}

export async function getTruckById(id) {
  const truck = await Truck.findById(id).populate('linkedFolderId', 'name relativePath');
  if (!truck) {
    const err = new Error('Truck not found');
    err.status = 404;
    throw err;
  }
  return truck;
}

export async function createTruck(payload, userId, user) {
  const data = validateTruckPayload(payload);
  await assertFolderExists(data.linkedFolderId, user);

  const exists = await Truck.findOne({ truckNumber: data.truckNumber });
  if (exists) {
    const err = new Error('Truck# already exists');
    err.status = 409;
    throw err;
  }

  const truck = await Truck.create({
    ...data,
    createdBy: userId,
  });

  if (truck.status === 'Active') {
    await TruckAssignment.create({ truckId: truck._id, history: [] });
  }

  return getTruckById(truck._id);
}

export async function updateTruck(id, payload, user) {
  const truck = await getTruckById(id);
  const data = validateTruckPayload({ ...truck.toObject(), ...payload }, { isUpdate: true });

  if (data.truckNumber && data.truckNumber !== truck.truckNumber) {
    const exists = await Truck.findOne({ truckNumber: data.truckNumber, _id: { $ne: id } });
    if (exists) {
      const err = new Error('Truck# already exists');
      err.status = 409;
      throw err;
    }
    truck.truckNumber = data.truckNumber;
  }

  if (payload.linkedFolderId !== undefined) {
    await assertFolderExists(payload.linkedFolderId, user);
    truck.linkedFolderId = payload.linkedFolderId || null;
  }

  truck.type = data.type;
  truck.status = data.status;
  truck.make = data.make;
  truck.model = data.model;
  truck.year = data.year;
  truck.vin = data.vin;
  truck.plateNumber = data.plateNumber;
  truck.dotInspectionExpiration = data.dotInspectionExpiration;
  truck.platesExpiration = data.platesExpiration;
  truck.notes = data.notes;

  await truck.save();

  const assignment = await TruckAssignment.findOne({ truckId: truck._id });
  if (truck.status === 'Active' && !assignment) {
    await TruckAssignment.create({ truckId: truck._id, history: [] });
  }

  return getTruckById(truck._id);
}

export async function deleteTruck(id) {
  const truck = await getTruckById(id);

  if (truck.status !== 'Terminated') {
    const err = new Error('Truck must have Terminated status before deletion');
    err.status = 400;
    throw err;
  }

  const assignment = await TruckAssignment.findOne({ truckId: id });
  if (assignment?.driverId || assignment?.coDriverId || assignment?.dispatcherId) {
    const err = new Error('Truck has active assignment and cannot be deleted');
    err.status = 400;
    throw err;
  }

  // Phase 2 will add load history check; placeholder for now
  await TruckAssignment.deleteOne({ truckId: id });
  await Truck.deleteOne({ _id: id });
  return { message: 'Truck deleted' };
}

export function formatTruckResponse(truck, options) {
  return formatTruck(truck, options);
}

export async function linkTruckFolder(id, linkedFolderId, user, req) {
  const { linkEntityFolder, ENTITY_FOLDER_TYPES } = await import('./entityFolderLinkService.js');
  const truck = await linkEntityFolder({
    getEntityById: getTruckById,
    entityId: id,
    linkedFolderId,
    user,
    req,
    entityType: ENTITY_FOLDER_TYPES.truck,
    getEntityName: (entity) => `Truck ${entity.truckNumber}`,
  });
  return truck;
}
