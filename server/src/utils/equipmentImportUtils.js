import { EQUIPMENT_STATUSES } from '../config/dispatchConstants.js';

const STATUS_SET = new Set(EQUIPMENT_STATUSES);

export function normalizeColumnKey(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/\s+/g, ' ');
}

/** Build lookup: normalized key -> value (first wins if duplicate columns). */
export function rowToNormalizedMap(row) {
  const map = new Map();
  for (const [key, value] of Object.entries(row)) {
    const nk = normalizeColumnKey(key);
    if (!nk) continue;
    if (!map.has(nk)) {
      map.set(nk, value);
    }
  }
  return map;
}

export function getCell(map, ...aliases) {
  for (const alias of aliases) {
    const v = map.get(normalizeColumnKey(alias));
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

export function normalizeUnitNumber(value) {
  return String(value || '').trim();
}

export function normalizeVin(value) {
  return String(value || '').trim().toUpperCase();
}

export function parseFlexibleDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date (approx range)
    if (value > 20000 && value < 80000) {
      const utcMs = Math.round((value - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

/** Active column: yes/true/1/y -> Active, no/false/0/n -> Not Active; empty uses status field. */
export function parseActiveColumn(str) {
  const s = String(str || '').trim().toLowerCase();
  if (!s) return null;
  if (['yes', 'true', '1', 'y', 'active'].includes(s)) return 'Active';
  if (['no', 'false', '0', 'n', 'inactive'].includes(s)) return 'Not Active';
  return null;
}

export function parseStatus(str) {
  const s = String(str || '').trim();
  if (!s) return 'Active';
  if (STATUS_SET.has(s)) return s;
  const lower = s.toLowerCase();
  if (lower === 'active') return 'Active';
  if (lower === 'terminated') return 'Terminated';
  if (lower === 'not active' || lower === 'inactive' || lower === 'notactive') return 'Not Active';
  const err = new Error(`Invalid status "${s}". Use Active, Not Active, or Terminated.`);
  err.status = 400;
  throw err;
}

export function resolveStatusFromRow(map) {
  const activeParsed = parseActiveColumn(getCell(map, 'Active', 'active'));
  const statusStr = getCell(map, 'Status', 'status');
  if (activeParsed) return activeParsed;
  if (statusStr) return parseStatus(statusStr);
  return 'Active';
}
