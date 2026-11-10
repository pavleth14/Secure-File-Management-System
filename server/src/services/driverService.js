import { Driver } from '../models/Driver.js';
import { TruckAssignment } from '../models/TruckAssignment.js';
import { formatDriver } from '../utils/dispatchFormat.js';
import {
  filterBySearch,
  filterByStatus,
  assertFolderExists,
} from './dispatchEntityHelpers.js';
import { DRIVER_TYPES, EQUIPMENT_STATUSES } from '../config/dispatchConstants.js';
import { canEditSafetyEntities } from '../utils/dispatchPermissions.js';
import { compareNaturalStrings } from '../utils/naturalStringSort.js';
import { parseFlexibleDate } from '../utils/equipmentImportUtils.js';

const DRIVER_SEARCH_FIELDS = [
  'name',
  'driverType',
  'status',
  'phone',
  'email',
  'ssn',
  'cdlNumber',
  'cdlState',
];

function validateDriverPayload(payload, { isUpdate = false } = {}) {
  const name = String(payload.name || '').trim();
  if (!isUpdate && !name) {
    const err = new Error('Driver name is required');
    err.status = 400;
    throw err;
  }

  const phone = String(payload.phone || '').trim();
  const ssnRaw = String(payload.ssn || '').trim();
  const cdlNumber = String(payload.cdlNumber || '').trim();

  if (!isUpdate) {
    if (!phone) {
      const err = new Error('Phone# is required');
      err.status = 400;
      throw err;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      const err = new Error('Phone# must have at least 7 digits');
      err.status = 400;
      throw err;
    }
    const ssnDigits = ssnRaw.replace(/\D/g, '');
    if (ssnRaw.trim() && ssnDigits.length !== 9) {
      const err = new Error('SSN must have 9 digits when provided');
      err.status = 400;
      throw err;
    }
    if (!cdlNumber) {
      const err = new Error('CDL# is required');
      err.status = 400;
      throw err;
    }
  } else {
    if (payload.phone !== undefined) {
      const digits = phone.replace(/\D/g, '');
      if (!phone.trim() || digits.length < 7) {
        const err = new Error('Phone# must have at least 7 digits');
        err.status = 400;
        throw err;
      }
    }
    if (payload.ssn !== undefined) {
      const digits = ssnRaw.replace(/\D/g, '');
      if (ssnRaw.trim() && digits.length !== 9) {
        const err = new Error('SSN must have 9 digits when provided');
        err.status = 400;
        throw err;
      }
    }
    if (payload.cdlNumber !== undefined && !cdlNumber) {
      const err = new Error('CDL# cannot be empty');
      err.status = 400;
      throw err;
    }
  }

  if (payload.driverType && !DRIVER_TYPES.includes(payload.driverType)) {
    const err = new Error('Invalid driver type');
    err.status = 400;
    throw err;
  }

  if (payload.status && !EQUIPMENT_STATUSES.includes(payload.status)) {
    const err = new Error('Invalid driver status');
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
    name,
    driverType: payload.driverType || 'Solo',
    isOwnerOperator: Boolean(payload.isOwnerOperator),
    dateOfBirth: parseFlexibleDate(payload.dateOfBirth),
    ssn: ssnRaw,
    phone,
    email: String(payload.email || '').trim(),
    hiredDate: parseFlexibleDate(payload.hiredDate),
    status: payload.status || 'Active',
    cdlNumber,
    cdlState: String(payload.cdlState || '').trim(),
    cdlExpiration: parseFlexibleDate(payload.cdlExpiration),
    linkedFolderId: payload.linkedFolderId || null,
  };

  if (importSheetOrder !== undefined) {
    result.importSheetOrder = importSheetOrder;
  }

  return result;
}

export async function listDrivers({ search, status, user } = {}) {
  let drivers = await Driver.find().populate('linkedFolderId', 'name relativePath');

  drivers = drivers.map((d) => d.toObject());

  if (!canEditSafetyEntities(user) && (!status || status === 'all')) {
    drivers = drivers.filter((driver) => driver.status === 'Active');
  }

  drivers = filterByStatus(drivers, status);
  drivers = filterBySearch(drivers, search, (driver) =>
    DRIVER_SEARCH_FIELDS.map((field) => driver[field])
  );

  drivers.sort((a, b) => {
    const ao = a.importSheetOrder;
    const bo = b.importSheetOrder;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return compareNaturalStrings(a.name, b.name);
  });

  return drivers.map((driver) => formatDriver(driver));
}

export async function getDriverById(id) {
  const driver = await Driver.findById(id).populate('linkedFolderId', 'name relativePath');
  if (!driver) {
    const err = new Error('Driver not found');
    err.status = 404;
    throw err;
  }
  return driver;
}

export async function createDriver(payload, userId, user) {
  const data = validateDriverPayload(payload);
  await assertFolderExists(data.linkedFolderId, user);

  const driver = await Driver.create({
    ...data,
    importSheetOrder: data.importSheetOrder ?? null,
    createdBy: userId,
  });

  return getDriverById(driver._id);
}

export async function updateDriver(id, payload, user) {
  const driver = await getDriverById(id);
  const existing = driver.toObject();
  const merged = { ...existing, ...payload };
  if (payload.importSheetOrder === undefined) {
    delete merged.importSheetOrder;
  }
  const data = validateDriverPayload(merged, { isUpdate: true });

  if (payload.linkedFolderId !== undefined) {
    await assertFolderExists(payload.linkedFolderId, user);
    driver.linkedFolderId = payload.linkedFolderId || null;
  }

  driver.name = data.name;
  driver.driverType = data.driverType;
  driver.isOwnerOperator = data.isOwnerOperator;
  driver.dateOfBirth = data.dateOfBirth;
  driver.ssn = data.ssn;
  driver.phone = data.phone;
  driver.email = data.email;
  driver.hiredDate = data.hiredDate;
  driver.status = data.status;
  driver.cdlNumber = data.cdlNumber;
  driver.cdlState = data.cdlState;
  driver.cdlExpiration = data.cdlExpiration;
  if (data.importSheetOrder !== undefined) {
    driver.importSheetOrder = data.importSheetOrder;
  }

  await driver.save();
  return getDriverById(driver._id);
}

export async function deleteDriver(id) {
  const driver = await getDriverById(id);

  if (driver.status !== 'Terminated') {
    const err = new Error('Driver must have Terminated status before deletion');
    err.status = 400;
    throw err;
  }

  const assigned = await TruckAssignment.findOne({
    $or: [{ driverId: id }, { coDriverId: id }],
  });
  if (assigned) {
    const err = new Error('Driver has active assignment and cannot be deleted');
    err.status = 400;
    throw err;
  }

  await Driver.deleteOne({ _id: id });
  return { message: 'Driver deleted' };
}

export function formatDriverResponse(driver, options) {
  return formatDriver(driver, options);
}

export async function linkDriverFolder(id, linkedFolderId, user, req) {
  const { linkEntityFolder, ENTITY_FOLDER_TYPES } = await import('./entityFolderLinkService.js');
  const driver = await linkEntityFolder({
    getEntityById: getDriverById,
    entityId: id,
    linkedFolderId,
    user,
    req,
    entityType: ENTITY_FOLDER_TYPES.driver,
    getEntityName: (entity) => entity.name,
  });
  return driver;
}
