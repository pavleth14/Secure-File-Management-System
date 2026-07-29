import { randomUUID } from 'crypto';
import { OldLead } from '../models/OldLead.js';
import { OldLeadImportPreview } from '../models/OldLeadImportPreview.js';
import {
  parseCsvBuffer,
  mapCsvRow,
  validateMappedRow,
  applyDuplicateChecks,
} from './leadImportService.js';
import { getLeadSourceNames } from './leadSourceService.js';

async function loadExistingOldLeadContactKeys(rows) {
  const emails = rows.map((row) => row.normalizedEmail).filter(Boolean);
  const phones = rows.map((row) => row.normalizedPhone).filter(Boolean);

  if (!emails.length && !phones.length) {
    return { emails: new Set(), phones: new Set() };
  }

  const existing = await OldLead.find({
    $or: [
      ...(emails.length ? [{ email: { $in: emails } }] : []),
      ...(phones.length ? [{ phone: { $in: phones } }] : []),
    ],
  }).select('email phone');

  return {
    emails: new Set(existing.map((lead) => lead.email)),
    phones: new Set(existing.map((lead) => lead.phone)),
  };
}

export async function previewOldLeadImport(manager, fileBuffer, fileName = '') {
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

  const existingKeys = await loadExistingOldLeadContactKeys(validatedRows);
  const seenInFile = { emails: new Set(), phones: new Set() };
  const rows = validatedRows.map((row) => applyDuplicateChecks(row, existingKeys, seenInFile));

  const previewId = randomUUID();
  await OldLeadImportPreview.create({
    previewId,
    manager: manager._id,
    fileName,
    rows: rows.map((row) => ({ ...row })),
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

export async function confirmOldLeadImport(manager, previewId, selectedRowNumbers = []) {
  const preview = await OldLeadImportPreview.findOne({
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
  const seenInBatch = { emails: new Set(), phones: new Set() };

  for (const row of selectedRows) {
    if (!row.isValid) {
      invalidRows += 1;
      continue;
    }

    if (
      (row.normalizedEmail && seenInBatch.emails.has(row.normalizedEmail)) ||
      (row.normalizedPhone && seenInBatch.phones.has(row.normalizedPhone))
    ) {
      skippedDuplicates += 1;
      continue;
    }

    const duplicate = await OldLead.findOne({
      $or: [{ email: row.normalizedEmail }, { phone: row.normalizedPhone }],
    }).select('_id');

    if (duplicate) {
      skippedDuplicates += 1;
      continue;
    }

    if (row.normalizedEmail) seenInBatch.emails.add(row.normalizedEmail);
    if (row.normalizedPhone) seenInBatch.phones.add(row.normalizedPhone);

    await OldLead.create({
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      phone: row.normalizedPhone,
      email: row.normalizedEmail,
      stateCity: row.stateCity?.trim() || '',
      status: row.resolvedStatus,
      driverType: row.resolvedDriverType,
      source: row.resolvedSource,
      date: row.date?.trim() || '',
      commentsText: row.comments?.trim() || '',
      importedAt: importTimestamp,
      importedBy: manager._id,
    });

    importedCount += 1;
  }

  await OldLeadImportPreview.deleteOne({ _id: preview._id });

  return {
    imported: importedCount,
    skippedDuplicates,
    invalidRows,
    totalSelected: selectedRows.length,
  };
}
