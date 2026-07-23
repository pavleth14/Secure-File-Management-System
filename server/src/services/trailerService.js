import { Trailer } from '../models/Trailer.js';
import { formatTrailer } from '../utils/dispatchFormat.js';
import {
  filterBySearch,
  filterByStatus,
  parseDateInput,
  assertFolderExists,
} from './dispatchEntityHelpers.js';
import { EQUIPMENT_STATUSES } from '../config/dispatchConstants.js';
import { canEditSafetyEntities } from '../utils/dispatchPermissions.js';

const TRAILER_SEARCH_FIELDS = [
  'trailerNumber',
  'type',
  'status',
  'size',
  'make',
  'model',
  'year',
  'vin',
  'plateNumber',
  'notes',
];

function validateTrailerPayload(payload, { isUpdate = false } = {}) {
  const trailerNumber = String(payload.trailerNumber || '').trim();
  if (!isUpdate && !trailerNumber) {
    const err = new Error('Trailer# is required');
    err.status = 400;
    throw err;
  }

  if (payload.status && !EQUIPMENT_STATUSES.includes(payload.status)) {
    const err = new Error('Invalid trailer status');
    err.status = 400;
    throw err;
  }

  return {
    trailerNumber,
    type: String(payload.type || '').trim(),
    status: payload.status || 'Active',
    size: String(payload.size || '').trim(),
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

export async function listTrailers({ search, status, user } = {}) {
  let trailers = await Trailer.find()
    .populate('linkedFolderId', 'name')
    .sort({ trailerNumber: 1 });

  trailers = trailers.map((t) => t.toObject());

  if (!canEditSafetyEntities(user) && (!status || status === 'all')) {
    trailers = trailers.filter((trailer) => trailer.status === 'Active');
  }

  trailers = filterByStatus(trailers, status);
  trailers = filterBySearch(trailers, search, (trailer) =>
    TRAILER_SEARCH_FIELDS.map((field) => trailer[field])
  );

  return trailers.map((trailer) => formatTrailer(trailer));
}

export async function getTrailerById(id) {
  const trailer = await Trailer.findById(id).populate('linkedFolderId', 'name');
  if (!trailer) {
    const err = new Error('Trailer not found');
    err.status = 404;
    throw err;
  }
  return trailer;
}

export async function createTrailer(payload, userId) {
  const data = validateTrailerPayload(payload);
  await assertFolderExists(data.linkedFolderId);

  const exists = await Trailer.findOne({ trailerNumber: data.trailerNumber });
  if (exists) {
    const err = new Error('Trailer# already exists');
    err.status = 409;
    throw err;
  }

  const trailer = await Trailer.create({
    ...data,
    createdBy: userId,
  });

  return getTrailerById(trailer._id);
}

export async function updateTrailer(id, payload) {
  const trailer = await getTrailerById(id);
  const data = validateTrailerPayload({ ...trailer.toObject(), ...payload }, { isUpdate: true });

  if (data.trailerNumber && data.trailerNumber !== trailer.trailerNumber) {
    const exists = await Trailer.findOne({
      trailerNumber: data.trailerNumber,
      _id: { $ne: id },
    });
    if (exists) {
      const err = new Error('Trailer# already exists');
      err.status = 409;
      throw err;
    }
    trailer.trailerNumber = data.trailerNumber;
  }

  if (payload.linkedFolderId !== undefined) {
    await assertFolderExists(payload.linkedFolderId);
    trailer.linkedFolderId = payload.linkedFolderId || null;
  }

  trailer.type = data.type;
  trailer.status = data.status;
  trailer.size = data.size;
  trailer.make = data.make;
  trailer.model = data.model;
  trailer.year = data.year;
  trailer.vin = data.vin;
  trailer.plateNumber = data.plateNumber;
  trailer.dotInspectionExpiration = data.dotInspectionExpiration;
  trailer.platesExpiration = data.platesExpiration;
  trailer.notes = data.notes;

  await trailer.save();
  return getTrailerById(trailer._id);
}

export async function deleteTrailer(id) {
  const trailer = await getTrailerById(id);

  if (trailer.status !== 'Terminated') {
    const err = new Error('Trailer must have Terminated status before deletion');
    err.status = 400;
    throw err;
  }

  await Trailer.deleteOne({ _id: id });
  return { message: 'Trailer deleted' };
}

export function formatTrailerResponse(trailer) {
  return formatTrailer(trailer);
}
