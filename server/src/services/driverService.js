import { Driver } from '../models/Driver.js';
import { TruckAssignment } from '../models/TruckAssignment.js';
import { formatDriver } from '../utils/dispatchFormat.js';
import {
  filterBySearch,
  filterByStatus,
  parseDateInput,
  assertFolderExists,
} from './dispatchEntityHelpers.js';
import { DRIVER_TYPES, EQUIPMENT_STATUSES } from '../config/dispatchConstants.js';

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

  return {
    name,
    driverType: payload.driverType || 'Solo',
    isOwnerOperator: Boolean(payload.isOwnerOperator),
    dateOfBirth: parseDateInput(payload.dateOfBirth),
    ssn: String(payload.ssn || '').trim(),
    phone: String(payload.phone || '').trim(),
    email: String(payload.email || '').trim(),
    hiredDate: parseDateInput(payload.hiredDate),
    status: payload.status || 'Active',
    cdlNumber: String(payload.cdlNumber || '').trim(),
    cdlState: String(payload.cdlState || '').trim(),
    cdlExpiration: parseDateInput(payload.cdlExpiration),
    linkedFolderId: payload.linkedFolderId || null,
  };
}

export async function listDrivers({ search, status } = {}) {
  let drivers = await Driver.find()
    .populate('linkedFolderId', 'name')
    .sort({ name: 1 });

  drivers = filterByStatus(drivers.map((d) => d.toObject()), status);
  drivers = filterBySearch(drivers, search, (driver) =>
    DRIVER_SEARCH_FIELDS.map((field) => driver[field])
  );

  return drivers.map((driver) => formatDriver(driver));
}

export async function getDriverById(id) {
  const driver = await Driver.findById(id).populate('linkedFolderId', 'name');
  if (!driver) {
    const err = new Error('Driver not found');
    err.status = 404;
    throw err;
  }
  return driver;
}

export async function createDriver(payload, userId) {
  const data = validateDriverPayload(payload);
  await assertFolderExists(data.linkedFolderId);

  const driver = await Driver.create({
    ...data,
    createdBy: userId,
  });

  return getDriverById(driver._id);
}

export async function updateDriver(id, payload) {
  const driver = await getDriverById(id);
  const data = validateDriverPayload({ ...driver.toObject(), ...payload }, { isUpdate: true });

  if (payload.linkedFolderId !== undefined) {
    await assertFolderExists(payload.linkedFolderId);
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
