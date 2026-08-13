import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { formatLeadDateIso } from '../utils/leadDateFormat.js';
import { normalizeImportEmailForEdit } from '../utils/importPlaceholderEmail.js';

const MAX_EXPORT_COMMENTS = 10;

const COMMENT_HEADERS = (() => {
  const headers = ['Comments'];
  for (let i = 2; i <= MAX_EXPORT_COMMENTS; i += 1) {
    headers.push(`Comment ${i}`);
  }
  return headers;
})();

export const LEAD_EXPORT_HEADERS = [
  'Status',
  'Type of Driver',
  'Source',
  'Date',
  'First Name',
  'Last Name',
  'Phone',
  'State / City',
  'Email',
  ...COMMENT_HEADERS,
  'Assigned Recruiter',
  'Lead ID',
  'Created At',
  'Updated At',
];

function slugifyFilenamePart(value) {
  return (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'export'
  );
}

function escapeCsvValue(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function collectCommentColumns(comments) {
  const sorted = [...(comments || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const columns = {};
  for (let i = 0; i < MAX_EXPORT_COMMENTS; i += 1) {
    const header = i === 0 ? 'Comments' : `Comment ${i + 1}`;
    columns[header] = sorted[i]?.text || '';
  }
  return columns;
}

export function leadToExportRow(lead) {
  const recruiterName = lead.assignedRecruiter?.name || '';
  const commentColumns = collectCommentColumns(lead.comments);

  return {
    Status: lead.status || '',
    'Type of Driver': lead.driverType || '',
    Source: lead.source || '',
    Date: formatLeadDateIso(lead.date, lead.createdAt) || '',
    'First Name': lead.firstName || '',
    'Last Name': lead.lastName || '',
    Phone: lead.phone || '',
    'State / City': lead.stateCity || '',
    Email: normalizeImportEmailForEdit(lead.email),
    ...commentColumns,
    'Assigned Recruiter': recruiterName,
    'Lead ID': lead._id?.toString?.() || '',
    'Created At': lead.createdAt ? new Date(lead.createdAt).toISOString() : '',
    'Updated At': lead.updatedAt ? new Date(lead.updatedAt).toISOString() : '',
  };
}

function rowsToCsv(rows) {
  const body = rows.map((row) =>
    LEAD_EXPORT_HEADERS.map((header) => escapeCsvValue(row[header])).join(',')
  );
  return [LEAD_EXPORT_HEADERS.join(','), ...body].join('\n');
}

function buildExportFilename(scopeLabel, format) {
  const datePart = new Date().toISOString().slice(0, 10);
  const ext = format === 'xlsx' || format === 'excel' ? 'xlsx' : 'csv';
  return `leads-export-${slugifyFilenamePart(scopeLabel)}-${datePart}.${ext}`;
}

export async function exportActiveLeads({ recruiterId, format = 'csv' }) {
  const filter = { archived: false };
  let scopeLabel = 'all-recruiters';

  if (recruiterId && recruiterId !== 'all') {
    if (!mongoose.Types.ObjectId.isValid(recruiterId)) {
      const err = new Error('Invalid recruiterId');
      err.status = 400;
      throw err;
    }

    const recruiter = await User.findById(recruiterId).select('name isRecruiter');
    if (!recruiter?.isRecruiter) {
      const err = new Error('Recruiter not found');
      err.status = 404;
      throw err;
    }

    filter.assignedRecruiter = recruiterId;
    scopeLabel = recruiter.name || recruiterId.toString();
  }

  const leads = await Lead.find(filter)
    .populate('assignedRecruiter', 'name')
    .populate('comments.author', 'name')
    .lean();

  leads.sort((a, b) => {
    const recruiterA = a.assignedRecruiter?.name || '';
    const recruiterB = b.assignedRecruiter?.name || '';
    const byRecruiter = recruiterA.localeCompare(recruiterB, undefined, { sensitivity: 'base' });
    if (byRecruiter !== 0) return byRecruiter;

    const byLast = (a.lastName || '').localeCompare(b.lastName || '', undefined, {
      sensitivity: 'base',
    });
    if (byLast !== 0) return byLast;

    return (a.firstName || '').localeCompare(b.firstName || '', undefined, {
      sensitivity: 'base',
    });
  });

  const rows = leads.map(leadToExportRow);
  const normalizedFormat = format === 'xlsx' || format === 'excel' ? 'xlsx' : 'csv';
  const filename = buildExportFilename(scopeLabel, normalizedFormat);

  if (normalizedFormat === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: LEAD_EXPORT_HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Active Leads');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename,
      rowCount: rows.length,
      scopeLabel,
    };
  }

  const csv = rowsToCsv(rows);
  return {
    buffer: Buffer.from('\uFEFF' + csv, 'utf8'),
    contentType: 'text/csv; charset=utf-8',
    filename,
    rowCount: rows.length,
    scopeLabel,
  };
}
