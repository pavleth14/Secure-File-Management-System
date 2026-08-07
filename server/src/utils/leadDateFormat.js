import XLSX from 'xlsx';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isExcelDateSerial(value) {
  const serial = Number(value);
  return Number.isFinite(serial) && serial >= 1 && serial <= 2958465;
}

function toIsoDateParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return '';
  }

  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return '';
  }

  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function dateToIso(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '';
  }
  return toIsoDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

/**
 * Normalize any lead date input to YYYY-MM-DD for storage and API responses.
 * Falls back to fallbackDate (typically createdAt/importedAt) when value is empty.
 */
export function formatLeadDateIso(value, fallbackDate) {
  if (value === null || value === undefined || value === '') {
    if (fallbackDate !== undefined && fallbackDate !== null && fallbackDate !== '') {
      return formatLeadDateIso(fallbackDate);
    }
    return '';
  }

  if (value instanceof Date) {
    return dateToIso(value);
  }

  if (typeof value === 'number') {
    if (isExcelDateSerial(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return toIsoDateParts(parsed.y, parsed.m, parsed.d);
      }
    }
    return '';
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return fallbackDate !== undefined && fallbackDate !== null && fallbackDate !== ''
      ? formatLeadDateIso(fallbackDate)
      : '';
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return toIsoDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const mdyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (mdyMatch) {
    return toIsoDateParts(mdyMatch[3], mdyMatch[1], mdyMatch[2]);
  }

  if (/^\d+(\.\d+)?$/.test(trimmed) && isExcelDateSerial(Number(trimmed))) {
    const parsed = XLSX.SSF.parse_date_code(Number(trimmed));
    if (parsed) {
      return toIsoDateParts(parsed.y, parsed.m, parsed.d);
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return dateToIso(parsed);
  }

  return '';
}
