import XLSX from 'xlsx';
import { Truck } from '../models/Truck.js';
import { Trailer } from '../models/Trailer.js';
import { createTruck, formatTruckResponse } from './truckService.js';
import { createTrailer, formatTrailerResponse } from './trailerService.js';
import {
  rowToNormalizedMap,
  getCell,
  normalizeUnitNumber,
  normalizeVin,
  parseFlexibleDate,
  resolveStatusFromRow,
} from '../utils/equipmentImportUtils.js';

const MAX_ROWS = 5000;

function sheetToObjects(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    const err = new Error('Spreadsheet has no sheets');
    err.status = 400;
    throw err;
  }
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  return Array.isArray(rows) ? rows : [];
}

function buildTruckPayloadFromRow(map) {
  const unit = normalizeUnitNumber(
    getCell(map, 'Truck', 'truck', 'truck number', 'truck#', 'unit', 'truck #')
  );
  const vinRaw = getCell(map, 'VIN', 'VIN#', 'vin', 'vin number');

  let status;
  try {
    status = resolveStatusFromRow(map);
  } catch (e) {
    const err = new Error(e.message || 'Invalid status');
    err.status = 400;
    throw err;
  }

  const dotRaw = getCell(
    map,
    'DOT Inspection Expiration',
    'dot inspection expiration',
    'dot inspection',
    'dot expiration'
  );
  const platesExpRaw = getCell(
    map,
    'Plates Expiration',
    'plates expiration',
    'plate expiration'
  );

  return {
    truckNumber: unit,
    type: getCell(map, 'Type', 'type'),
    status,
    make: getCell(map, 'Make', 'make'),
    model: getCell(map, 'Model', 'model'),
    year: getCell(map, 'Year', 'year'),
    vin: normalizeVin(vinRaw),
    plateNumber: getCell(map, 'Plate#', 'Plate', 'plate', 'plate number'),
    dotInspectionExpiration: parseFlexibleDate(dotRaw),
    platesExpiration: parseFlexibleDate(platesExpRaw),
    notes: '',
    linkedFolderId: null,
  };
}

function buildTrailerPayloadFromRow(map) {
  const unit = normalizeUnitNumber(
    getCell(map, 'Trailer', 'Trailer#', 'trailer', 'trailer number', 'unit', 'trailer #')
  );
  const vinRaw = getCell(map, 'VIN', 'VIN#', 'vin', 'vin number');

  let status;
  try {
    status = resolveStatusFromRow(map);
  } catch (e) {
    const err = new Error(e.message || 'Invalid status');
    err.status = 400;
    throw err;
  }

  const dotRaw = getCell(
    map,
    'DOT Inspection Expiration',
    'dot inspection expiration',
    'dot inspection',
    'dot expiration'
  );
  const platesExpRaw = getCell(
    map,
    'Plates Expiration',
    'plates expiration',
    'plate expiration'
  );

  return {
    trailerNumber: unit,
    type: getCell(map, 'Type', 'type'),
    status,
    size: getCell(map, 'Size', 'size'),
    make: getCell(map, 'Make', 'make'),
    model: getCell(map, 'Model', 'model'),
    year: getCell(map, 'Year', 'year'),
    vin: normalizeVin(vinRaw),
    plateNumber: getCell(map, 'Plate#', 'Plate', 'plate', 'plate number'),
    dotInspectionExpiration: parseFlexibleDate(dotRaw),
    platesExpiration: parseFlexibleDate(platesExpRaw),
    notes: '',
    linkedFolderId: null,
  };
}

export async function importTrucksFromBuffer(buffer, user) {
  const rows = sheetToObjects(buffer);
  if (rows.length > MAX_ROWS) {
    const err = new Error(`Too many rows (max ${MAX_ROWS})`);
    err.status = 400;
    throw err;
  }

  const created = [];
  const errors = [];
  const seenUnits = new Set();
  const seenVins = new Set();

  for (let i = 0; i < rows.length; i += 1) {
    const sheetRow = i + 2;
    const map = rowToNormalizedMap(rows[i]);

    let payload;
    try {
      payload = buildTruckPayloadFromRow(map);
    } catch (e) {
      errors.push({ row: sheetRow, message: e.message || 'Invalid row' });
      continue;
    }

    if (!payload.truckNumber) {
      errors.push({ row: sheetRow, message: 'Missing Truck# / UNIT' });
      continue;
    }
    if (!payload.vin) {
      errors.push({ row: sheetRow, message: 'Missing VIN' });
      continue;
    }

    const unitKey = payload.truckNumber.toLowerCase();
    const vinKey = payload.vin;
    if (seenUnits.has(unitKey)) {
      errors.push({ row: sheetRow, message: `Duplicate Truck# in file: ${payload.truckNumber}` });
      continue;
    }
    if (seenVins.has(vinKey)) {
      errors.push({ row: sheetRow, message: `Duplicate VIN in file: ${payload.vin}` });
      continue;
    }
    seenUnits.add(unitKey);
    seenVins.add(vinKey);

    const existingUnit = await Truck.findOne({
      truckNumber: new RegExp(`^${escapeRegexStrict(payload.truckNumber)}$`, 'i'),
    }).lean();
    if (existingUnit) {
      errors.push({
        row: sheetRow,
        message: `Truck# already exists: ${payload.truckNumber}`,
      });
      continue;
    }

    const existingVin = await Truck.findOne({ vin: payload.vin }).lean();
    if (existingVin) {
      errors.push({
        row: sheetRow,
        message: `VIN already exists on truck ${existingVin.truckNumber}`,
      });
      continue;
    }

    try {
      const truck = await createTruck(payload, user._id, user);
      created.push(formatTruckResponse(truck));
    } catch (e) {
      errors.push({
        row: sheetRow,
        message: e.message || 'Failed to create truck',
      });
    }
  }

  return { created: created.length, trucks: created, errors };
}

export async function importTrailersFromBuffer(buffer, user) {
  const rows = sheetToObjects(buffer);
  if (rows.length > MAX_ROWS) {
    const err = new Error(`Too many rows (max ${MAX_ROWS})`);
    err.status = 400;
    throw err;
  }

  const created = [];
  const errors = [];
  const seenUnits = new Set();
  const seenVins = new Set();

  for (let i = 0; i < rows.length; i += 1) {
    const sheetRow = i + 2;
    const map = rowToNormalizedMap(rows[i]);

    let payload;
    try {
      payload = buildTrailerPayloadFromRow(map);
    } catch (e) {
      errors.push({ row: sheetRow, message: e.message || 'Invalid row' });
      continue;
    }

    if (!payload.trailerNumber) {
      errors.push({ row: sheetRow, message: 'Missing Trailer# / UNIT' });
      continue;
    }
    if (!payload.vin) {
      errors.push({ row: sheetRow, message: 'Missing VIN' });
      continue;
    }

    const unitKey = payload.trailerNumber.toLowerCase();
    const vinKey = payload.vin;
    if (seenUnits.has(unitKey)) {
      errors.push({
        row: sheetRow,
        message: `Duplicate Trailer# in file: ${payload.trailerNumber}`,
      });
      continue;
    }
    if (seenVins.has(vinKey)) {
      errors.push({ row: sheetRow, message: `Duplicate VIN in file: ${payload.vin}` });
      continue;
    }
    seenUnits.add(unitKey);
    seenVins.add(vinKey);

    const existingUnit = await Trailer.findOne({
      trailerNumber: new RegExp(`^${escapeRegexStrict(payload.trailerNumber)}$`, 'i'),
    }).lean();
    if (existingUnit) {
      errors.push({
        row: sheetRow,
        message: `Trailer# already exists: ${payload.trailerNumber}`,
      });
      continue;
    }

    const existingVin = await Trailer.findOne({ vin: payload.vin }).lean();
    if (existingVin) {
      errors.push({
        row: sheetRow,
        message: `VIN already exists on trailer ${existingVin.trailerNumber}`,
      });
      continue;
    }

    try {
      const trailer = await createTrailer(payload, user._id, user);
      created.push(formatTrailerResponse(trailer));
    } catch (e) {
      errors.push({
        row: sheetRow,
        message: e.message || 'Failed to create trailer',
      });
    }
  }

  return { created: created.length, trailers: created, errors };
}

function escapeRegexStrict(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
