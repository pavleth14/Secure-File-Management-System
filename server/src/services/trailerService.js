import { Trailer } from '../models/Trailer.js';
import { formatTrailer } from '../utils/dispatchFormat.js';
import {
  filterBySearch,
  filterByStatus,
  parseDateInput,
  assertFolderExists,
} from './dispatchEntityHelpers.js';
import { compareNaturalStrings } from '../utils/naturalStringSort.js';
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

function normalizeVinInput(value) {
  return String(value || '').trim().toUpperCase();
}

function validateTrailerPayload(payload, { isUpdate = false } = {}) {
  const trailerNumber = String(payload.trailerNumber || '').trim();
  if (!isUpdate && !trailerNumber) {
    const err = new Error('Trailer# is required');
    err.status = 400;
    throw err;
  }

  const vin = normalizeVinInput(payload.vin);
  if (!vin) {
    const err = new Error('VIN is required');
    err.status = 400;
    throw err;
  }

  if (payload.status && !EQUIPMENT_STATUSES.includes(payload.status)) {
    const err = new Error('Invalid trailer status');
    err.status = 400;
    throw err;
  }

  let importSheetOrder;
  if (payload.importSheetOrder !== undefined) {
    if (payload.importSheetOrder === null || payload.importSheetOrder === '') {
      importSheetOrder = null;
    } else {
      const num = Number(payload.importSheetOrder);
      importSheetOrder =
        Number.isFinite(num) && num >= 0 ? Math.floor(num) : null;
    }
  } else if (!isUpdate) {
    importSheetOrder = null;
  }

  const result = {
    trailerNumber,
    type: String(payload.type || '').trim(),
    status: payload.status || 'Active',
    size: String(payload.size || '').trim(),
    make: String(payload.make || '').trim(),
    model: String(payload.model || '').trim(),
    year: String(payload.year || '').trim(),
    vin,
    plateNumber: String(payload.plateNumber || '').trim(),
    dotInspectionExpiration: parseDateInput(payload.dotInspectionExpiration),
    platesExpiration: parseDateInput(payload.platesExpiration),
    notes: String(payload.notes || '').trim(),
    linkedFolderId: payload.linkedFolderId || null,
  };

  if (importSheetOrder !== undefined) {
    result.importSheetOrder = importSheetOrder;
  }

  return result;
}

export async function listTrailers({ search, status, user } = {}) {
  let trailers = await Trailer.find().populate('linkedFolderId', 'name relativePath');

  trailers = trailers.map((t) => t.toObject());

  if (!canEditSafetyEntities(user) && (!status || status === 'all')) {
    trailers = trailers.filter((trailer) => trailer.status === 'Active');
  }

  trailers = filterByStatus(trailers, status);
  trailers = filterBySearch(trailers, search, (trailer) =>
    TRAILER_SEARCH_FIELDS.map((field) => trailer[field])
  );

  trailers.sort((a, b) => {
    const ao = a.importSheetOrder;
    const bo = b.importSheetOrder;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return compareNaturalStrings(a.trailerNumber, b.trailerNumber);
  });

  return trailers.map((trailer) => formatTrailer(trailer));
}

export async function getTrailerById(id) {
  const trailer = await Trailer.findById(id).populate('linkedFolderId', 'name relativePath');
  if (!trailer) {
    const err = new Error('Trailer not found');
    err.status = 404;
    throw err;
  }
  return trailer;
}

export async function createTrailer(payload, userId, user) {
  const data = validateTrailerPayload(payload);
  await assertFolderExists(data.linkedFolderId, user);

  const exists = await Trailer.findOne({ trailerNumber: data.trailerNumber });
  if (exists) {
    const err = new Error('Trailer# already exists');
    err.status = 409;
    throw err;
  }

  if (data.vin) {
    const vinTaken = await Trailer.findOne({ vin: data.vin });
    if (vinTaken) {
      const err = new Error(`VIN already exists on trailer ${vinTaken.trailerNumber}`);
      err.status = 409;
      throw err;
    }
  }

  const trailer = await Trailer.create({
    ...data,
    importSheetOrder: data.importSheetOrder ?? null,
    createdBy: userId,
  });

  return getTrailerById(trailer._id);
}

export async function updateTrailer(id, payload, user) {
  const trailer = await getTrailerById(id);
  const existing = trailer.toObject();
  const merged = { ...existing, ...payload };
  if (payload.importSheetOrder === undefined) {
    delete merged.importSheetOrder;
  }
  const data = validateTrailerPayload(merged, { isUpdate: true });

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

  if (data.vin && data.vin !== normalizeVinInput(trailer.vin)) {
    const vinTaken = await Trailer.findOne({ vin: data.vin, _id: { $ne: id } });
    if (vinTaken) {
      const err = new Error(`VIN already exists on trailer ${vinTaken.trailerNumber}`);
      err.status = 409;
      throw err;
    }
  }

  if (payload.linkedFolderId !== undefined) {
    await assertFolderExists(payload.linkedFolderId, user);
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
  if (data.importSheetOrder !== undefined) {
    trailer.importSheetOrder = data.importSheetOrder;
  }

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

export async function linkTrailerFolder(id, linkedFolderId, user, req) {
  const { linkEntityFolder, ENTITY_FOLDER_TYPES } = await import('./entityFolderLinkService.js');
  const trailer = await linkEntityFolder({
    getEntityById: getTrailerById,
    entityId: id,
    linkedFolderId,
    user,
    req,
    entityType: ENTITY_FOLDER_TYPES.trailer,
    getEntityName: (entity) => `Trailer ${entity.trailerNumber}`,
  });
  return trailer;
}
