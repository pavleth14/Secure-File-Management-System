import XLSX from 'xlsx';
import { Driver } from '../models/Driver.js';
import { createDriver, formatDriverResponse } from './driverService.js';
import {
  rowToNormalizedMap,
  getCell,
  parseFlexibleDate,
  normalizeColumnKey,
} from '../utils/equipmentImportUtils.js';
import { DRIVER_TYPES, EQUIPMENT_STATUSES } from '../config/dispatchConstants.js';
import {
  parseEmploymentTypeLabel,
  syncLegacyOwnerOperatorFlag,
} from '../utils/driverEmploymentType.js';

const MAX_ROWS = 5000;

const DRIVER_TYPE_SET = new Set(DRIVER_TYPES);
const STATUS_SET = new Set(EQUIPMENT_STATUSES);

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

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeSsnDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCdl(value) {
  return String(value || '').trim().toUpperCase();
}

function parseYesNo(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return null;
  if (['yes', 'true', '1', 'y', 'x'].includes(s)) return true;
  if (['no', 'false', '0', 'n'].includes(s)) return false;
  return null;
}

/** PT list: Type=TRUE → Company Driver; FALSE → Owner Operator (also Company Driver column). */
function parseEmploymentFromTypeColumn(map) {
  const raw = map.get(normalizeColumnKey('Type'));
  if (raw === true) return 'Company Driver';
  if (raw === false) return 'Owner Operator';

  const explicit = getCell(
    map,
    'Employment Type',
    'employment type',
    'Driver Category',
    'driver category'
  );
  const fromExplicit = parseEmploymentTypeLabel(explicit);
  if (fromExplicit) return fromExplicit;

  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  const fromType = parseEmploymentTypeLabel(raw);
  if (fromType) return fromType;
  if (['solo', 'team', 'local', 'solo driver', 'team driver'].includes(s)) return null;
  if (DRIVER_TYPE_SET.has(String(raw).trim())) return null;
  return null;
}

function parseDriverTypeAndOo(map) {
  let employmentType = null;
  let employmentFromTypeColumn = false;

  const companyDriverCell = getCell(map, 'Company Driver', 'company driver');
  const companyDriverFlag = parseYesNo(companyDriverCell);
  if (companyDriverFlag !== null) {
    employmentType = companyDriverFlag ? 'Company Driver' : 'Owner Operator';
    employmentFromTypeColumn = true;
  } else {
    const employmentFromType = parseEmploymentFromTypeColumn(map);
    if (employmentFromType) {
      employmentType = employmentFromType;
      employmentFromTypeColumn = true;
    }
  }

  if (!employmentType) {
    const ooCol = getCell(
      map,
      'Owner Operator',
      'owner operator',
      'Owner operator',
      'OO',
      'O/O'
    );
    const ooParsed = parseYesNo(ooCol);
    if (ooParsed === true) employmentType = 'Owner Operator';
    else if (ooParsed === false) employmentType = 'Company Driver';
    else {
      const fromOoText = parseEmploymentTypeLabel(ooCol);
      if (fromOoText) employmentType = fromOoText;
      else {
        const lower = String(ooCol || '').trim().toLowerCase();
        if (lower.includes('owner') && lower.includes('operator')) {
          employmentType = 'Owner Operator';
        }
      }
    }
  }

  if (!employmentType) employmentType = 'Company Driver';
  const isOwnerOperator = syncLegacyOwnerOperatorFlag(employmentType);

  const typeCol = employmentFromTypeColumn
    ? getCell(
        map,
        'Type of Driver',
        'type of driver',
        'Driver Type',
        'driver type'
      )
    : getCell(
        map,
        'Type of Driver',
        'type of driver',
        'Driver Type',
        'driver type',
        'Type',
        'type'
      );
  const soloCol = parseYesNo(getCell(map, 'Solo', 'solo'));
  const teamWord = getCell(map, 'Team', 'team');

  let driverType = 'Solo';
  const t = String(typeCol || '').trim();
  if (t) {
    const lower = t.toLowerCase();
    if (lower === 'team' || lower === 'team driver') driverType = 'Team';
    else if (lower === 'solo' || lower === 'solo driver') driverType = 'Solo';
    else if (DRIVER_TYPE_SET.has(t)) driverType = t;
  } else if (soloCol === false && teamWord) {
    driverType = 'Team';
  }

  return { driverType, employmentType, isOwnerOperator };
}

function parseStatusCell(map) {
  const raw = getCell(map, 'Status', 'status');
  if (!raw) return 'Active';
  const s = String(raw).trim();
  if (STATUS_SET.has(s)) return s;
  const lower = s.toLowerCase();
  if (lower === 'active') return 'Active';
  if (lower === 'terminated') return 'Terminated';
  if (lower === 'not active' || lower === 'inactive') return 'Not Active';
  const err = new Error(`Invalid status: ${s}`);
  err.status = 400;
  throw err;
}

function buildDriverPayloadFromRow(map) {
  const name = getCell(
    map,
    'Name',
    'name',
    'Driver Name',
    'driver name',
    'Full Name',
    'full name'
  );
  const { driverType, employmentType, isOwnerOperator } = parseDriverTypeAndOo(map);

  const dobRaw = getCell(
    map,
    'Date of Birth',
    'date of birth',
    'DOB',
    'dob',
    'Birth Date'
  );
  const ssnRaw = getCell(map, 'SSN', 'SSN#', 'ssn', 'social security');
  const phoneRaw = getCell(
    map,
    'Phone',
    'Phone#',
    'phone',
    'phone number',
    'Mobile',
    'Cell'
  );
  const email = getCell(map, 'Email', 'email', 'E-mail');
  const hiredRaw = getCell(map, 'Hired Date', 'hired date', 'Hire Date', 'hire date');
  const status = parseStatusCell(map);
  const cdlNum = getCell(
    map,
    'CDL#',
    'CDL',
    'cdl',
    'cdl number',
    'CDL Number',
    'CDL #'
  );
  const cdlState = getCell(map, 'CDL State', 'cdl state', 'State', 'License State');
  const cdlExpRaw = getCell(
    map,
    'CDL Expiration Date',
    'cdl expiration date',
    'CDL Expiration',
    'cdl expiration',
    'CDL Exp',
    'CDL exp'
  );

  return {
    name,
    driverType,
    employmentType,
    isOwnerOperator,
    dateOfBirth: parseFlexibleDate(dobRaw),
    ssn: String(ssnRaw || '').trim(),
    phone: String(phoneRaw || '').trim(),
    email: String(email || '').trim(),
    hiredDate: parseFlexibleDate(hiredRaw),
    status,
    cdlNumber: String(cdlNum || '').trim(),
    cdlState: String(cdlState || '').trim(),
    cdlExpiration: parseFlexibleDate(cdlExpRaw),
    linkedFolderId: null,
  };
}

export async function importDriversFromBuffer(buffer, user) {
  const rows = sheetToObjects(buffer);
  if (rows.length > MAX_ROWS) {
    const err = new Error(`Too many rows (max ${MAX_ROWS})`);
    err.status = 400;
    throw err;
  }

  const existingDocs = await Driver.find()
    .select('phone ssn cdlNumber')
    .lean();

  const dbPhones = new Set(
    existingDocs.map((d) => normalizePhoneDigits(d.phone)).filter((p) => p.length >= 7)
  );
  const dbSsns = new Set(
    existingDocs.map((d) => normalizeSsnDigits(d.ssn)).filter((s) => s.length === 9)
  );
  const dbCdls = new Set(
    existingDocs.map((d) => normalizeCdl(d.cdlNumber)).filter(Boolean)
  );

  const created = [];
  const errors = [];
  const seenPhones = new Set();
  const seenSsns = new Set();
  const seenCdls = new Set();

  for (let i = 0; i < rows.length; i += 1) {
    const sheetRow = i + 2;
    const map = rowToNormalizedMap(rows[i]);

    let payload;
    try {
      payload = buildDriverPayloadFromRow(map);
    } catch (e) {
      errors.push({ row: sheetRow, message: e.message || 'Invalid row' });
      continue;
    }

    if (!payload.name?.trim()) {
      errors.push({ row: sheetRow, message: 'Missing Name' });
      continue;
    }

    const phoneDigits = normalizePhoneDigits(payload.phone);
    if (!phoneDigits || phoneDigits.length < 7) {
      errors.push({ row: sheetRow, message: 'Missing or invalid Phone#' });
      continue;
    }

    const ssnDigits = normalizeSsnDigits(payload.ssn);
    const ssnProvided = String(payload.ssn || '').trim();
    if (ssnProvided && ssnDigits.length !== 9) {
      errors.push({ row: sheetRow, message: 'Invalid SSN (need 9 digits when provided)' });
      continue;
    }

    if (!payload.cdlNumber?.trim()) {
      errors.push({ row: sheetRow, message: 'Missing CDL#' });
      continue;
    }

    const cdlNorm = normalizeCdl(payload.cdlNumber);

    if (seenPhones.has(phoneDigits)) {
      errors.push({
        row: sheetRow,
        message: 'Skipped — duplicate Phone# in file',
      });
      continue;
    }
    if (ssnDigits.length === 9 && seenSsns.has(ssnDigits)) {
      errors.push({
        row: sheetRow,
        message: 'Skipped — duplicate SSN in file',
      });
      continue;
    }
    if (seenCdls.has(cdlNorm)) {
      errors.push({
        row: sheetRow,
        message: `Skipped — duplicate CDL# in file: ${payload.cdlNumber}`,
      });
      continue;
    }

    if (dbPhones.has(phoneDigits)) {
      errors.push({
        row: sheetRow,
        message: 'Skipped — Phone# already in database',
      });
      continue;
    }
    if (ssnDigits.length === 9 && dbSsns.has(ssnDigits)) {
      errors.push({
        row: sheetRow,
        message: 'Skipped — SSN already in database',
      });
      continue;
    }
    if (dbCdls.has(cdlNorm)) {
      errors.push({
        row: sheetRow,
        message: `Skipped — CDL# already in database: ${payload.cdlNumber}`,
      });
      continue;
    }

    seenPhones.add(phoneDigits);
    if (ssnDigits.length === 9) seenSsns.add(ssnDigits);
    seenCdls.add(cdlNorm);

    try {
      const driver = await createDriver(
        {
          ...payload,
          phone: payload.phone.trim(),
          ssn: ssnDigits.length === 9 ? payload.ssn.trim() : '',
          cdlNumber: payload.cdlNumber.trim(),
          importSheetOrder: i,
        },
        user._id,
        user
      );
      created.push(formatDriverResponse(driver, { includeSsn: true }));
      dbPhones.add(phoneDigits);
      if (ssnDigits.length === 9) dbSsns.add(ssnDigits);
      dbCdls.add(cdlNorm);
    } catch (e) {
      seenPhones.delete(phoneDigits);
      if (ssnDigits.length === 9) seenSsns.delete(ssnDigits);
      seenCdls.delete(cdlNorm);
      errors.push({
        row: sheetRow,
        message: e.message || 'Failed to create driver',
      });
    }
  }

  return { created: created.length, drivers: created, errors };
}
