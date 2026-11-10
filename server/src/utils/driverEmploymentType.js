import { SAFETY_DRIVER_EMPLOYMENT_TYPES } from '../config/dispatchConstants.js';

const EMPLOYMENT_SET = new Set(SAFETY_DRIVER_EMPLOYMENT_TYPES);

export function parseEmploymentTypeLabel(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'true' || s === 'company driver' || s === 'company') return 'Company Driver';
  if (s === 'false' || s === 'owner operator' || s === 'owner') return 'Owner Operator';
  if (
    s === 'dfoop' ||
    s === 'driving for owner operator' ||
    s === 'driving for oo' ||
    s.includes('dfoop')
  ) {
    return 'DFOOP';
  }
  const titled = String(value).trim();
  if (EMPLOYMENT_SET.has(titled)) return titled;
  return null;
}

export function resolveDriverEmploymentType(driver) {
  const raw = driver?.employmentType;
  if (raw && EMPLOYMENT_SET.has(raw)) return raw;
  if (driver?.isOwnerOperator) return 'Owner Operator';
  return 'Company Driver';
}

export function syncLegacyOwnerOperatorFlag(employmentType) {
  return employmentType === 'Owner Operator';
}
