import { formatChicagoDisplay, chicagoStartOfDay, chicagoEndOfDay } from '../utils/chicagoTime.js';
import { DISPATCH_TIMEZONE } from '../config/dispatchConstants.js';
import { listMaintenanceCases } from './maintenanceCaseService.js';

function chicagoDateParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPATCH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const mapped = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)])
  );
  return { year: mapped.year, month: mapped.month, day: mapped.day };
}

function partsToDateStr({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Calendar period containing referenceDate (Chicago), inclusive. */
export function resolveMaintenanceReportPeriod(period, referenceDateStr) {
  const refStr =
    referenceDateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(referenceDateStr).trim())
      ? String(referenceDateStr).trim()
      : partsToDateStr(chicagoDateParts(new Date()));

  const [y, m, d] = refStr.split('-').map(Number);
  let startStr;
  let endStr;

  if (period === 'week') {
    const ref = new Date(Date.UTC(y, m - 1, d));
    const day = ref.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    ref.setUTCDate(ref.getUTCDate() + diffToMonday);
    const monday = { year: ref.getUTCFullYear(), month: ref.getUTCMonth() + 1, day: ref.getUTCDate() };
    startStr = partsToDateStr(monday);
    const endRef = new Date(Date.UTC(monday.year, monday.month - 1, monday.day));
    endRef.setUTCDate(endRef.getUTCDate() + 6);
    endStr = partsToDateStr({
      year: endRef.getUTCFullYear(),
      month: endRef.getUTCMonth() + 1,
      day: endRef.getUTCDate(),
    });
  } else if (period === 'quarter') {
    const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
    startStr = partsToDateStr({ year: y, month: qStartMonth, day: 1 });
    const endMonth = qStartMonth + 2;
    const lastDay = new Date(y, endMonth, 0).getDate();
    endStr = partsToDateStr({ year: y, month: endMonth, day: lastDay });
  } else {
    startStr = partsToDateStr({ year: y, month: m, day: 1 });
    const lastDay = new Date(y, m, 0).getDate();
    endStr = partsToDateStr({ year: y, month: m, day: lastDay });
  }

  return {
    period: period === 'week' ? 'week' : period === 'quarter' ? 'quarter' : 'month',
    referenceDate: refStr,
    from: chicagoStartOfDay(startStr),
    to: chicagoEndOfDay(endStr),
    fromLabel: startStr,
    toLabel: endStr,
  };
}

function getReportDateForCase(c) {
  return c.dateClosed ? new Date(c.dateClosed) : new Date(c.createdAt);
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvRow(values) {
  return values.map(csvEscape).join(',');
}

export async function exportMaintenanceCostReport(query = {}) {
  const period = ['week', 'month', 'quarter'].includes(query.period) ? query.period : 'month';
  const range = resolveMaintenanceReportPeriod(period, query.referenceDate);
  const withCostOnly = String(query.withCostOnly || '').toLowerCase() === 'true';

  const listResult = await listMaintenanceCases({
    ...query,
    page: 1,
    limit: 5000,
  });

  let rows = listResult.cases.filter((c) => {
    const reportDate = getReportDateForCase(c);
    return reportDate >= range.from && reportDate <= range.to;
  });

  if (withCostOnly) {
    rows = rows.filter((c) => c.cost !== null && c.cost !== undefined);
  }

  const headers = [
    'Case ID',
    'Issue',
    'Truck',
    'Trailer',
    'Assignee',
    'Case Status',
    'Repair Shop',
    'Cost (USD)',
    'Date Closed',
    'Report Date',
    'Invoice Status',
    'Project',
    'Attachments',
    'Created At',
  ];

  const dataRows = rows.map((c) => {
    const reportDate = getReportDateForCase(c);
    const attachmentNames = (c.attachments || []).map((a) => a.originalName).join('; ');
    return buildCsvRow([
      c.id,
      c.issue,
      c.truckNumber || '',
      c.trailerNumber || '',
      c.assigneeName || '',
      c.caseStatus || '',
      c.repairShop || '',
      c.cost != null ? Number(c.cost).toFixed(2) : '',
      c.dateClosedLabel || '',
      formatChicagoDisplay(reportDate).split(',')[0],
      c.invoiceStatus || '',
      c.project || '',
      attachmentNames,
      formatChicagoDisplay(c.createdAt),
    ]);
  });

  const totalCost = rows.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);

  const lines = [
    `# Maintenance cost report (${range.period})`,
    `# Period: ${range.fromLabel} to ${range.toLabel} (Chicago)`,
    `# Report date uses Date Closed, or Created At if not closed`,
    `# Cases: ${rows.length}`,
    `# Total cost (USD): ${totalCost.toFixed(2)}`,
    '',
    buildCsvRow(headers),
    ...dataRows,
  ];

  const body = `\uFEFF${lines.join('\r\n')}`;
  const filename = `maintenance-cost-${range.period}-${range.fromLabel}_to_${range.toLabel}.csv`;

  return {
    body,
    filename,
    contentType: 'text/csv; charset=utf-8',
    meta: {
      caseCount: rows.length,
      totalCost,
      ...range,
    },
  };
}
