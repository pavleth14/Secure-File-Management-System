import { MaintenanceParkingRecord } from '../models/MaintenanceParkingRecord.js';
import { MAINTENANCE_PARKING_STATUSES } from '../config/maintenanceConstants.js';
import {
  chicagoStartOfDay,
  chicagoEndOfDay,
  formatChicagoDisplay,
  formatChicagoDateTime,
} from '../utils/chicagoTime.js';

const POPULATE = [
  { path: 'createdBy', select: 'name' },
  { path: 'lastEditedBy', select: 'name' },
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseOptionalDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return chicagoStartOfDay(value.trim());
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error('Invalid date');
    err.status = 400;
    throw err;
  }
  return parsed;
}

function parseOptionalAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    const err = new Error('Invalid amount');
    err.status = 400;
    throw err;
  }
  return Math.round(num * 100) / 100;
}

function normalizeTimeLabel(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text);
  if (!match) {
    const err = new Error('Time must be in h:mm AM/PM format (e.g. 2:30 PM)');
    err.status = 400;
    throw err;
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    const err = new Error('Invalid time value');
    err.status = 400;
    throw err;
  }
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function formatDateLabel(date) {
  if (!date) return '';
  return formatChicagoDisplay(date).split(',')[0];
}

function isParkingEndDateToday(endDate) {
  if (!endDate) return false;
  const todayKey = formatChicagoDateTime(new Date()).date;
  const endKey = formatChicagoDateTime(endDate).date;
  return Boolean(todayKey && endKey && todayKey === endKey);
}

function formatRecord(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const parkingExpiresToday = isParkingEndDateToday(obj.endDate);
  return {
    id: obj._id.toString(),
    unitNumber: obj.unitNumber || '',
    startDate: obj.startDate,
    startDateLabel: formatDateLabel(obj.startDate),
    endDate: obj.endDate,
    endDateLabel: formatDateLabel(obj.endDate),
    timeLabel: obj.timeLabel || '',
    address: obj.address || '',
    amount: obj.amount ?? null,
    amountLabel:
      obj.amount !== null && obj.amount !== undefined
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(obj.amount)
        : '',
    status: obj.status,
    note: obj.note || '',
    createdAt: obj.createdAt,
    lastEditedAt: obj.lastEditedAt,
    createdByName: obj.createdBy?.name || null,
    lastEditedByName: obj.lastEditedBy?.name || null,
    parkingExpiresToday,
  };
}

function sortParkingRecordsForDisplay(records) {
  return [...records].sort((a, b) => {
    if (a.parkingExpiresToday !== b.parkingExpiresToday) {
      return a.parkingExpiresToday ? -1 : 1;
    }
    const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
    if (aStart !== bStart) return bStart - aStart;
    const aEdited = a.lastEditedAt ? new Date(a.lastEditedAt).getTime() : 0;
    const bEdited = b.lastEditedAt ? new Date(b.lastEditedAt).getTime() : 0;
    return bEdited - aEdited;
  });
}

function validatePayload(payload, { partial = false } = {}) {
  const data = {};

  if (payload.unitNumber !== undefined || !partial) {
    const unitNumber = String(payload.unitNumber || '').trim();
    if (!unitNumber) {
      const err = new Error('Unit number is required');
      err.status = 400;
      throw err;
    }
    data.unitNumber = unitNumber;
  }

  if (payload.startDate !== undefined) {
    data.startDate = parseOptionalDate(payload.startDate);
  }
  if (payload.endDate !== undefined) {
    data.endDate = parseOptionalDate(payload.endDate);
  }
  if (payload.timeLabel !== undefined) {
    const timeRaw = String(payload.timeLabel || '').trim();
    data.timeLabel = timeRaw ? normalizeTimeLabel(timeRaw) : '';
  } else if (!partial) {
    data.timeLabel = '';
  }

  if (payload.address !== undefined) {
    data.address = String(payload.address || '').trim();
  }
  if (payload.amount !== undefined) {
    data.amount = parseOptionalAmount(payload.amount);
  }
  if (payload.note !== undefined) {
    data.note = String(payload.note || '').trim();
  }

  if (payload.status !== undefined || !partial) {
    const status = String(payload.status || '').trim();
    if (!MAINTENANCE_PARKING_STATUSES.includes(status)) {
      const err = new Error('Invalid parking status');
      err.status = 400;
      throw err;
    }
    data.status = status;
  }

  return data;
}

function touchEdited(record, userId) {
  record.lastEditedAt = new Date();
  record.lastEditedBy = userId;
}

export async function listMaintenanceParkingRecords(query = {}) {
  const and = [];
  const unit = String(query.unit || query.search || '').trim();
  if (unit) {
    and.push({ unitNumber: new RegExp(escapeRegex(unit), 'i') });
  }

  const statusList = String(query.status || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (statusList.length) {
    and.push({ status: { $in: statusList } });
  }

  if (query.startDateFrom) {
    const from = parseOptionalDate(query.startDateFrom);
    if (from) and.push({ startDate: { $gte: from } });
  }
  if (query.startDateTo) {
    const to = parseOptionalDate(query.startDateTo);
    if (to) and.push({ startDate: { $lte: chicagoEndOfDay(query.startDateTo) } });
  }

  const filter = and.length ? { $and: and } : {};
  const limit = Math.min(Math.max(Number(query.limit) || 200, 1), 500);

  const records = await MaintenanceParkingRecord.find(filter)
    .sort({ startDate: -1, lastEditedAt: -1 })
    .limit(limit)
    .populate(POPULATE);

  return sortParkingRecordsForDisplay(records.map(formatRecord));
}

export async function getMaintenanceParkingRecordById(id) {
  const record = await MaintenanceParkingRecord.findById(id).populate(POPULATE);
  if (!record) {
    const err = new Error('Parking record not found');
    err.status = 404;
    throw err;
  }
  return formatRecord(record);
}

export async function createMaintenanceParkingRecord(payload, user) {
  const data = validatePayload(payload, { partial: false });
  const record = await MaintenanceParkingRecord.create({
    ...data,
    createdBy: user._id,
    lastEditedBy: user._id,
    lastEditedAt: new Date(),
  });
  return getMaintenanceParkingRecordById(record._id);
}

export async function updateMaintenanceParkingRecord(id, payload, user) {
  const record = await MaintenanceParkingRecord.findById(id);
  if (!record) {
    const err = new Error('Parking record not found');
    err.status = 404;
    throw err;
  }

  const data = validatePayload(payload, { partial: true });
  Object.assign(record, data);
  touchEdited(record, user._id);
  await record.save();
  return getMaintenanceParkingRecordById(record._id);
}

export async function deleteMaintenanceParkingRecord(id) {
  const record = await MaintenanceParkingRecord.findByIdAndDelete(id);
  if (!record) {
    const err = new Error('Parking record not found');
    err.status = 404;
    throw err;
  }
  return { id: record._id.toString() };
}