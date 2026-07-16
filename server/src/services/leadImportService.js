import XLSX from 'xlsx';
import validator from 'validator';
import { randomUUID } from 'crypto';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { RecruitingState } from '../models/RecruitingState.js';
import { LeadImportPreview } from '../models/LeadImportPreview.js';
import {
  LEAD_STATUSES,
  DRIVER_TYPES,
  DEFAULT_LEAD_STATUS,
} from '../config/recruitingConstants.js';
import { handleLeadDuplicateError } from './leadService.js';
import { getLeadSourceNames } from './leadSourceService.js';

const IMPORT_COMMENT_AUTHOR_LABEL = 'Importing Recruiting Manager';

const HEADER_TO_FIELD = {
  status: 'status',
  'type of driver': 'driverType',
  source: 'source',
  date: 'date',
  'first name': 'firstName',
  'last name': 'lastName',
  phone: 'phone',
  'state / city': 'stateCity',
  'state/city': 'stateCity',
  email: 'email',
  comments: 'comments',
};

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function parseCsvBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const err = new Error('CSV file is empty');
    err.status = 400;
    throw err;
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function mapCsvRow(rawRow) {
  const mapped = {};
  for (const [header, value] of Object.entries(rawRow)) {
    const field = HEADER_TO_FIELD[normalizeHeader(header)];
    if (field) {
      mapped[field] = String(value ?? '').trim();
    }
  }
  return mapped;
}

function parseLeadDate(value, fallbackDate) {
  if (!value) return fallbackDate;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackDate;
  }
  return parsed;
}

function validateMappedRow(row, importDate, allowedSources) {
  const errors = [];
  const warnings = [];

  if (!row.firstName) errors.push('First Name is required');
  if (!row.lastName) errors.push('Last Name is required');
  if (!row.phone) errors.push('Phone is required');
  if (!row.email) errors.push('Email is required');
  if (!row.driverType) errors.push('Type of Driver is required');
  if (!row.source) errors.push('Source is required');

  if (row.email && !validator.isEmail(row.email, { allow_utf8_local_part: false })) {
    errors.push('Invalid email format');
  }

  if (row.status && !LEAD_STATUSES.includes(row.status)) {
    errors.push(`Invalid status: ${row.status}`);
  }

  if (row.driverType && !DRIVER_TYPES.includes(row.driverType)) {
    errors.push(`Invalid driver type: ${row.driverType}`);
  }

  if (row.source && !allowedSources.includes(row.source)) {
    errors.push(`Invalid source: ${row.source}`);
  }

  const parsedCreatedAt = parseLeadDate(row.date, importDate);
  if (row.date) {
    const directParse = new Date(row.date);
    if (Number.isNaN(directParse.getTime())) {
      warnings.push('Invalid date in CSV; import date will be used');
    }
  }

  return {
    errors,
    warnings,
    parsedCreatedAt,
    normalizedEmail: row.email ? normalizeEmail(row.email) : '',
    normalizedPhone: row.phone ? normalizePhone(row.phone) : '',
    status: row.status && LEAD_STATUSES.includes(row.status) ? row.status : DEFAULT_LEAD_STATUS,
    driverType: row.driverType,
    source: row.source,
  };
}

async function loadExistingContactKeys(rows) {
  const emails = rows.map((row) => row.normalizedEmail).filter(Boolean);
  const phones = rows.map((row) => row.normalizedPhone).filter(Boolean);

  if (!emails.length && !phones.length) {
    return { emails: new Set(), phones: new Set() };
  }

  const existingLeads = await Lead.find({
    $or: [
      ...(emails.length ? [{ email: { $in: emails } }] : []),
      ...(phones.length ? [{ phone: { $in: phones } }] : []),
    ],
  }).select('email phone');

  return {
    emails: new Set(existingLeads.map((lead) => lead.email)),
    phones: new Set(existingLeads.map((lead) => lead.phone)),
  };
}

function applyDuplicateChecks(row, existingKeys, seenInFile) {
  const warnings = [...row.warnings];
  let isDuplicate = false;
  let duplicateReason = '';

  if (row.normalizedEmail) {
    if (existingKeys.emails.has(row.normalizedEmail)) {
      isDuplicate = true;
      duplicateReason = 'email';
      warnings.push('Email already exists');
    } else if (seenInFile.emails.has(row.normalizedEmail)) {
      isDuplicate = true;
      duplicateReason = 'email_in_file';
      warnings.push('Duplicate email within CSV');
    } else {
      seenInFile.emails.add(row.normalizedEmail);
    }
  }

  if (row.normalizedPhone) {
    if (existingKeys.phones.has(row.normalizedPhone)) {
      isDuplicate = true;
      duplicateReason = duplicateReason || 'phone';
      warnings.push('Phone already exists');
    } else if (seenInFile.phones.has(row.normalizedPhone)) {
      isDuplicate = true;
      duplicateReason = duplicateReason || 'phone_in_file';
      warnings.push('Duplicate phone within CSV');
    } else {
      seenInFile.phones.add(row.normalizedPhone);
    }
  }

  return {
    ...row,
    warnings,
    isDuplicate,
    duplicateReason,
    defaultSelected: row.errors.length === 0 && !isDuplicate,
  };
}

export async function previewLeadImport(manager, fileBuffer, fileName = '') {
  const rawRows = parseCsvBuffer(fileBuffer);
  if (!rawRows.length) {
    const err = new Error('CSV file contains no data rows');
    err.status = 400;
    throw err;
  }

  const importDate = new Date();
  const allowedSources = await getLeadSourceNames();
  const validatedRows = rawRows.map((rawRow, index) => {
    const mapped = mapCsvRow(rawRow);
    const validation = validateMappedRow(mapped, importDate, allowedSources);

    return {
      rowNumber: index + 1,
      status: mapped.status || '',
      driverType: mapped.driverType || '',
      source: mapped.source || '',
      date: mapped.date || '',
      firstName: mapped.firstName || '',
      lastName: mapped.lastName || '',
      phone: mapped.phone || '',
      stateCity: mapped.stateCity || '',
      email: mapped.email || '',
      comments: mapped.comments || '',
      parsedCreatedAt: validation.parsedCreatedAt,
      errors: validation.errors,
      warnings: validation.warnings,
      isValid: validation.errors.length === 0,
      normalizedEmail: validation.normalizedEmail,
      normalizedPhone: validation.normalizedPhone,
      resolvedStatus: validation.status,
      resolvedDriverType: validation.driverType,
      resolvedSource: validation.source,
      isDuplicate: false,
      duplicateReason: '',
      defaultSelected: false,
    };
  });

  const existingKeys = await loadExistingContactKeys(validatedRows);
  const seenInFile = { emails: new Set(), phones: new Set() };

  const rows = validatedRows.map((row) => applyDuplicateChecks(row, existingKeys, seenInFile));

  const previewId = randomUUID();
  await LeadImportPreview.create({
    previewId,
    manager: manager._id,
    fileName,
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      status: row.status,
      driverType: row.driverType,
      source: row.source,
      date: row.date,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      stateCity: row.stateCity,
      email: row.email,
      comments: row.comments,
      resolvedStatus: row.resolvedStatus,
      resolvedDriverType: row.resolvedDriverType,
      resolvedSource: row.resolvedSource,
      normalizedEmail: row.normalizedEmail,
      normalizedPhone: row.normalizedPhone,
      parsedCreatedAt: row.parsedCreatedAt,
      errors: row.errors,
      warnings: row.warnings,
      isValid: row.isValid,
      isDuplicate: row.isDuplicate,
      duplicateReason: row.duplicateReason,
      defaultSelected: row.defaultSelected,
    })),
  });

  return {
    previewId,
    fileName,
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      status: row.resolvedStatus || row.status,
      driverType: row.driverType,
      source: row.source,
      date: row.date,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      stateCity: row.stateCity,
      email: row.email,
      comments: row.comments,
      parsedCreatedAt: row.parsedCreatedAt,
      errors: row.errors,
      warnings: row.warnings,
      isValid: row.isValid,
      isDuplicate: row.isDuplicate,
      duplicateReason: row.duplicateReason,
      defaultSelected: row.defaultSelected,
    })),
    summary: {
      totalRows: rows.length,
      validRows: rows.filter((row) => row.isValid).length,
      invalidRows: rows.filter((row) => !row.isValid).length,
      duplicateRows: rows.filter((row) => row.isDuplicate).length,
    },
  };
}

async function getActiveRecruiters() {
  return User.find({ isRecruiter: true }).sort({ name: 1 }).select('_id name');
}

async function getRoundRobinAssignments(count) {
  const recruiters = await getActiveRecruiters();
  if (!recruiters.length) {
    const err = new Error('No active recruiters available for assignment');
    err.status = 400;
    throw err;
  }

  const assignments = [];
  const state = await RecruitingState.findOneAndUpdate(
    { key: 'round_robin' },
    { $setOnInsert: { key: 'round_robin', lastRecruiterIndex: -1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let index = state.lastRecruiterIndex ?? -1;
  for (let i = 0; i < count; i += 1) {
    index = (index + 1) % recruiters.length;
    assignments.push(recruiters[index]._id);
  }

  await RecruitingState.findOneAndUpdate(
    { key: 'round_robin' },
    { $set: { lastRecruiterIndex: index } }
  );

  return assignments;
}

async function revalidateRowForImport(row) {
  if (!row.isValid) {
    return { ok: false, errors: row.errors?.length ? row.errors : ['Invalid row'] };
  }

  const duplicate = await Lead.findOne({
    $or: [{ email: row.normalizedEmail }, { phone: row.normalizedPhone }],
  }).select('_id email phone');

  if (duplicate) {
    const reason =
      duplicate.email === row.normalizedEmail
        ? 'Email already exists'
        : 'Phone already exists';
    return { ok: false, errors: [reason], duplicate: true };
  }

  return {
    ok: true,
    payload: {
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      phone: row.normalizedPhone,
      email: row.normalizedEmail,
      stateCity: row.stateCity?.trim() || '',
      status: row.resolvedStatus,
      driverType: row.resolvedDriverType,
      source: row.resolvedSource,
      createdAt: row.parsedCreatedAt,
      commentsText: row.comments?.trim() || '',
    },
  };
}

export async function confirmLeadImport(manager, previewId, selectedRowNumbers = []) {
  const preview = await LeadImportPreview.findOne({
    previewId,
    manager: manager._id,
  });

  if (!preview) {
    const err = new Error('Import preview not found or expired');
    err.status = 404;
    throw err;
  }

  const selectedSet = new Set(
    Array.isArray(selectedRowNumbers)
      ? selectedRowNumbers.map((value) => Number(value))
      : []
  );

  const selectedRows = preview.rows.filter((row) => selectedSet.has(row.rowNumber));

  let importedCount = 0;
  let skippedDuplicates = 0;
  let invalidRows = 0;
  const importTimestamp = new Date();

  const rowsToImport = [];
  const seenInBatch = { emails: new Set(), phones: new Set() };

  for (const row of selectedRows) {
    if (
      (row.normalizedEmail && seenInBatch.emails.has(row.normalizedEmail)) ||
      (row.normalizedPhone && seenInBatch.phones.has(row.normalizedPhone))
    ) {
      skippedDuplicates += 1;
      continue;
    }

    const validation = await revalidateRowForImport(row);
    if (!validation.ok) {
      if (validation.duplicate) {
        skippedDuplicates += 1;
      } else {
        invalidRows += 1;
      }
      continue;
    }

    if (row.normalizedEmail) seenInBatch.emails.add(row.normalizedEmail);
    if (row.normalizedPhone) seenInBatch.phones.add(row.normalizedPhone);
    rowsToImport.push({ row, payload: validation.payload });
  }

  if (!rowsToImport.length) {
    await LeadImportPreview.deleteOne({ _id: preview._id });
    return {
      imported: 0,
      skippedDuplicates,
      invalidRows,
      totalSelected: selectedRows.length,
    };
  }

  const assignments = await getRoundRobinAssignments(rowsToImport.length);

  for (let index = 0; index < rowsToImport.length; index += 1) {
    const { payload } = rowsToImport[index];
    const assignedRecruiter = assignments[index];

    const leadData = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      email: payload.email,
      stateCity: payload.stateCity,
      status: payload.status,
      driverType: payload.driverType,
      source: payload.source,
      assignedRecruiter,
      createdAt: payload.createdAt,
      updatedAt: importTimestamp,
    };

    if (payload.commentsText) {
      leadData.comments = [
        {
          text: payload.commentsText,
          author: manager._id,
          authorLabel: IMPORT_COMMENT_AUTHOR_LABEL,
          createdAt: importTimestamp,
          updatedAt: importTimestamp,
        },
      ];
    }

    try {
      await Lead.create(leadData);
      importedCount += 1;
    } catch (err) {
      const duplicateErr = handleLeadDuplicateError(err);
      if (duplicateErr) {
        skippedDuplicates += 1;
      } else {
        invalidRows += 1;
      }
    }
  }

  await LeadImportPreview.deleteOne({ _id: preview._id });

  return {
    imported: importedCount,
    skippedDuplicates,
    invalidRows,
    totalSelected: selectedRows.length,
  };
}
