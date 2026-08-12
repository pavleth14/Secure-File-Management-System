import XLSX from 'xlsx';
import validator from 'validator';
import { randomUUID } from 'crypto';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { LeadImportPreview } from '../models/LeadImportPreview.js';
import {
  DRIVER_TYPES,
  DEFAULT_LEAD_STATUS,
} from '../config/recruitingConstants.js';
import { handleLeadDuplicateError } from './leadService.js';
import { getLeadSourceNames } from './leadSourceService.js';
import { getLeadStatusNames } from './leadStatusService.js';
import { prependStatusCommentsToLeadData } from './leadStatusChangeService.js';
import { auditLeadStatusChanged } from './recruitingAuditService.js';
import { getRoundRobinAssignments } from './roundRobinService.js';
import { formatLeadDateIso } from '../utils/leadDateFormat.js';
import { notifyCsvImportSlack } from './slackNotificationService.js';
import {
  generateImportPlaceholderEmail,
} from '../utils/importPlaceholderEmail.js';

const IMPORT_COMMENT_AUTHOR_LABEL = 'Importing Recruiting Manager';
const MAX_IMPORT_COMMENTS = 10;
const IMPORT_COMMENT_MAX_LENGTH = 2000;
const MISSING_EMAIL_IMPORT_WARNING =
  'Email is missing; a placeholder will be assigned on import';

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
};

function getImportCommentColumnOrder(normalizedHeader) {
  if (normalizedHeader === 'comments' || normalizedHeader === 'comment') {
    return 1;
  }

  const match = normalizedHeader.match(/^comment\s+(\d+)$/);
  if (!match) return null;

  return Number(match[1]);
}

function collectImportComments(rawRow) {
  const entries = [];

  for (const [header, value] of Object.entries(rawRow)) {
    const normalized = normalizeHeader(header);
    const order = getImportCommentColumnOrder(normalized);
    if (order === null || order < 1 || order > MAX_IMPORT_COMMENTS) continue;

    const text = String(value ?? '').trim();
    if (text) {
      entries.push({ order, text });
    }
  }

  entries.sort((a, b) => a.order - b.order);

  const seenOrders = new Set();
  const comments = [];
  for (const entry of entries) {
    if (seenOrders.has(entry.order)) continue;
    seenOrders.add(entry.order);
    comments.push(entry.text);
    if (comments.length >= MAX_IMPORT_COMMENTS) break;
  }

  return comments;
}

function validateImportComments(importComments, rawRow) {
  const errors = [];
  const warnings = [];

  for (const [header, value] of Object.entries(rawRow)) {
    const normalized = normalizeHeader(header);
    const order = getImportCommentColumnOrder(normalized);
    if (order === null || order <= MAX_IMPORT_COMMENTS) continue;

    if (String(value ?? '').trim()) {
      warnings.push(
        `Comment ${order} ignored; maximum ${MAX_IMPORT_COMMENTS} comments per row`
      );
    }
  }

  importComments.forEach((text, index) => {
    if (text.length > IMPORT_COMMENT_MAX_LENGTH) {
      errors.push(
        `Comment ${index + 1} exceeds ${IMPORT_COMMENT_MAX_LENGTH} characters`
      );
    }
  });

  return { errors, warnings };
}

function formatCommentsPreview(importComments) {
  if (!importComments?.length) return '';
  if (importComments.length === 1) return importComments[0];
  return `${importComments[0]} (+${importComments.length - 1} more)`;
}

function buildImportCommentEntries(importComments, { authorId, authorLabel, timestamp }) {
  return (importComments || [])
    .map((text) => String(text || '').trim())
    .filter(Boolean)
    .map((text) => ({
      text,
      author: authorId,
      authorLabel,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
}

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

function resolveImportEmail(normalizedEmail, emailMissing) {
  if (emailMissing || !normalizedEmail) {
    return generateImportPlaceholderEmail();
  }
  return normalizedEmail;
}

function buildImportDuplicateFilter(normalizedEmail, normalizedPhone, emailMissing = false) {
  const conditions = [{ phone: normalizedPhone }];
  if (!emailMissing && normalizedEmail) {
    conditions.unshift({ email: normalizedEmail });
  }
  return { $or: conditions };
}

function parseCsvBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const err = new Error('CSV file is empty');
    err.status = 400;
    throw err;
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
  if (rows.length > 0) {
    const dateKey = Object.keys(rows[0]).find((key) => HEADER_TO_FIELD[normalizeHeader(key)] === 'date');
    // Temporary date import debugging
    console.log('[DATE-IMPORT] after XLSX parse (row 1)', {
      rawDateValue: dateKey ? rows[0][dateKey] : undefined,
      rawDateType: dateKey ? typeof rows[0][dateKey] : undefined,
    });
  }
  return rows;
}

function isExcelDateSerial(value) {
  const serial = Number(value);
  return Number.isFinite(serial) && serial >= 1 && serial <= 2958465;
}

function formatExcelSerialToDateString(serial) {
  const parsed = XLSX.SSF.parse_date_code(Number(serial));
  if (!parsed) return String(serial);
  return `${parsed.m}/${parsed.d}/${parsed.y}`;
}

function normalizeImportDateValue(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`;
  }

  if (typeof value === 'number') {
    if (isExcelDateSerial(value)) {
      return formatExcelSerialToDateString(value);
    }
    return String(value).trim();
  }

  const trimmed = String(value).trim();
  if (!trimmed) return '';

  if (/^\d+(\.\d+)?$/.test(trimmed) && isExcelDateSerial(Number(trimmed))) {
    return formatExcelSerialToDateString(Number(trimmed));
  }

  return trimmed;
}

function mapCsvRow(rawRow) {
  const mapped = {};
  for (const [header, value] of Object.entries(rawRow)) {
    const field = HEADER_TO_FIELD[normalizeHeader(header)];
    if (field) {
      mapped[field] =
        field === 'date' ? formatLeadDateIso(value) : String(value ?? '').trim();
    }
  }
  // Temporary date import debugging
  if (mapped.date !== undefined) {
    console.log('[DATE-IMPORT] mapCsvRow', { date: mapped.date });
  }
  return mapped;
}

function parseLeadDate(value, fallbackDate) {
  const normalized = normalizeImportDateValue(value);
  if (!normalized) return fallbackDate;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackDate;
  }
  return parsed;
}

function validateMappedRow(row, importDate, allowedSources, allowedStatuses) {
  const errors = [];
  const warnings = [];

  if (!row.firstName) errors.push('First Name is required');
  if (!row.lastName) errors.push('Last Name is required');
  if (!row.phone) errors.push('Phone is required');
  if (!row.driverType) errors.push('Type of Driver is required');
  if (!row.source) errors.push('Source is required');

  const emailMissing = !String(row.email || '').trim();
  if (emailMissing) {
    warnings.push(MISSING_EMAIL_IMPORT_WARNING);
  }

  if (row.email && !validator.isEmail(row.email, { allow_utf8_local_part: false })) {
    errors.push('Invalid email format');
  }

  if (row.status && !allowedStatuses.includes(row.status)) {
    errors.push(`Invalid status: ${row.status}`);
  }

  if (row.driverType && !DRIVER_TYPES.includes(row.driverType)) {
    errors.push(`Invalid driver type: ${row.driverType}`);
  }

  if (row.source && !allowedSources.includes(row.source)) {
    errors.push(`Invalid source: ${row.source}`);
  }

  const parsedCreatedAt = parseLeadDate(row.date, importDate);
  if (row.date && !normalizeImportDateValue(row.date)) {
    warnings.push('Invalid date in CSV; import date will be used');
  } else if (row.date && parsedCreatedAt.getTime() === importDate.getTime()) {
    const normalized = normalizeImportDateValue(row.date);
    if (normalized && Number.isNaN(new Date(normalized).getTime())) {
      warnings.push('Invalid date in CSV; import date will be used');
    }
  }

  return {
    errors,
    warnings,
    parsedCreatedAt,
    emailMissing,
    normalizedEmail: row.email ? normalizeEmail(row.email) : '',
    normalizedPhone: row.phone ? normalizePhone(row.phone) : '',
    status: row.status && allowedStatuses.includes(row.status) ? row.status : DEFAULT_LEAD_STATUS,
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

async function assertAssignedRecruiter(userId) {
  if (!userId) return null;

  const recruiter = await User.findById(userId).select('_id name isRecruiter');
  if (!recruiter?.isRecruiter) {
    const err = new Error('Selected user is not an active recruiter');
    err.status = 400;
    throw err;
  }

  return recruiter;
}

export async function previewLeadImport(
  manager,
  fileBuffer,
  fileName = '',
  assignedRecruiterId = null
) {
  const rawRows = parseCsvBuffer(fileBuffer);
  if (!rawRows.length) {
    const err = new Error('CSV file contains no data rows');
    err.status = 400;
    throw err;
  }

  const importDate = new Date();
  const allowedSources = await getLeadSourceNames();
  const allowedStatuses = await getLeadStatusNames();
  const validatedRows = rawRows.map((rawRow, index) => {
    const mapped = mapCsvRow(rawRow);
    const importComments = collectImportComments(rawRow);
    const commentValidation = validateImportComments(importComments, rawRow);
    const validation = validateMappedRow(mapped, importDate, allowedSources, allowedStatuses);

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
      importComments,
      comments: formatCommentsPreview(importComments),
      parsedCreatedAt: validation.parsedCreatedAt,
      errors: [...validation.errors, ...commentValidation.errors],
      warnings: [...validation.warnings, ...commentValidation.warnings],
      isValid: validation.errors.length === 0 && commentValidation.errors.length === 0,
      emailMissing: validation.emailMissing,
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

  let assignedRecruiter = null;
  if (assignedRecruiterId) {
    assignedRecruiter = await assertAssignedRecruiter(assignedRecruiterId);
  }

  const previewId = randomUUID();
  await LeadImportPreview.create({
    previewId,
    manager: manager._id,
    fileName,
    assignedRecruiterId: assignedRecruiter?._id || null,
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
      importComments: row.importComments,
      comments: row.comments,
      resolvedStatus: row.resolvedStatus,
      resolvedDriverType: row.resolvedDriverType,
      resolvedSource: row.resolvedSource,
      normalizedEmail: row.normalizedEmail,
      normalizedPhone: row.normalizedPhone,
      emailMissing: Boolean(row.emailMissing),
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
    assignedRecruiter: assignedRecruiter
      ? { id: assignedRecruiter._id, name: assignedRecruiter.name }
      : null,
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
      importComments: row.importComments,
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

async function revalidateRowForImport(row) {
  if (!row.isValid) {
    return { ok: false, errors: row.errors?.length ? row.errors : ['Invalid row'] };
  }

  const emailMissing = Boolean(row.emailMissing);
  const duplicate = await Lead.findOne(
    buildImportDuplicateFilter(row.normalizedEmail, row.normalizedPhone, emailMissing)
  ).select('_id email phone');

  if (duplicate) {
    const reason =
      !emailMissing && duplicate.email === row.normalizedEmail
        ? 'Email already exists'
        : 'Phone already exists';
    return { ok: false, errors: [reason], duplicate: true };
  }

  const resolvedEmail = resolveImportEmail(row.normalizedEmail, emailMissing);

  return {
    ok: true,
    payload: {
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      phone: row.normalizedPhone,
      email: resolvedEmail,
      stateCity: row.stateCity?.trim() || '',
      status: row.resolvedStatus,
      driverType: row.resolvedDriverType,
      source: row.resolvedSource,
      date: formatLeadDateIso(row.date, row.parsedCreatedAt) || '',
      createdAt: row.parsedCreatedAt,
      importComments: row.importComments || [],
    },
  };
}

export async function confirmLeadImport(manager, previewId, selectedRowNumbers = [], req = null) {
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

  let assignments;
  let assignedRecruiterDoc = null;
  const importedLeadsForSlack = [];

  if (preview.assignedRecruiterId) {
    assignedRecruiterDoc = await assertAssignedRecruiter(preview.assignedRecruiterId);
    assignments = rowsToImport.map(() => assignedRecruiterDoc._id);

    console.log('[SPECIFIC-USER-IMPORT]', {
      selectedRecruiterId: assignedRecruiterDoc._id.toString(),
      selectedRecruiterName: assignedRecruiterDoc.name,
      importedLeadsCount: rowsToImport.length,
    });
  } else {
    assignments = await getRoundRobinAssignments(
      rowsToImport.map(({ payload }) => ({ driverType: payload.driverType }))
    );
  }

  for (let index = 0; index < rowsToImport.length; index += 1) {
    const { payload } = rowsToImport[index];
    const assignedRecruiter = assignments[index];

    if (preview.assignedRecruiterId) {
      console.log('[SPECIFIC-USER-IMPORT] assignedRecruiter before save', {
        leadEmail: payload.email,
        assignedRecruiter: assignedRecruiter.toString(),
      });
    }

    let leadData = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      email: payload.email,
      stateCity: payload.stateCity,
      status: payload.status,
      driverType: payload.driverType,
      source: payload.source,
      date: formatLeadDateIso(payload.date, payload.createdAt) || '',
      assignedRecruiter,
      createdAt: payload.createdAt,
      importedAt: importTimestamp,
      updatedAt: importTimestamp,
    };

    // Temporary date import debugging
    console.log('[DATE-IMPORT] before Lead.create', { date: leadData.date, email: leadData.email });

    if (payload.importComments?.length) {
      leadData.comments = buildImportCommentEntries(payload.importComments, {
        authorId: manager._id,
        authorLabel: IMPORT_COMMENT_AUTHOR_LABEL,
        timestamp: importTimestamp,
      });
    }

    leadData = prependStatusCommentsToLeadData(leadData, {
      userId: manager._id,
      oldStatus: null,
      newStatus: payload.status,
      timestamp: importTimestamp,
    });

    try {
      const createdLead = await Lead.create(leadData);
      importedCount += 1;
      importedLeadsForSlack.push({
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        email: payload.email,
        stateCity: payload.stateCity,
        status: payload.status,
        driverType: payload.driverType,
        source: payload.source,
        assignedRecruiter,
      });
      if (req) {
        await auditLeadStatusChanged({
          user: manager,
          lead: createdLead,
          req,
          oldStatus: null,
          newStatus: payload.status,
        });
      }
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

  if (importedLeadsForSlack.length > 0) {
    notifyCsvImportSlack(importedLeadsForSlack, { sourceLabel: 'CSV Import' });
  }

  return {
    imported: importedCount,
    skippedDuplicates,
    invalidRows,
    totalSelected: selectedRows.length,
  };
}

export {
  parseCsvBuffer,
  mapCsvRow,
  validateMappedRow,
  applyDuplicateChecks,
  collectImportComments,
  validateImportComments,
  formatCommentsPreview,
  buildImportCommentEntries,
  resolveImportEmail,
  generateImportPlaceholderEmail,
  buildImportDuplicateFilter,
  MAX_IMPORT_COMMENTS,
  MISSING_EMAIL_IMPORT_WARNING,
};
