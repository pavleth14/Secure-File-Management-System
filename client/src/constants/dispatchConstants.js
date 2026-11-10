export const EQUIPMENT_STATUSES = ['Active', 'Terminated', 'Not Active'];

export const DRIVER_TYPES = ['Solo', 'Team'];

export const SAFETY_DRIVER_EMPLOYMENT_TYPES = [
  'Company Driver',
  'Owner Operator',
  'DFOOP',
];

export const SAFETY_DRIVER_EMPLOYMENT_LABELS = {
  'Company Driver': 'Company Driver',
  'Owner Operator': 'Owner Operator',
  DFOOP: 'DFOOP (Driving For Owner Operator)',
};

export function formatEmploymentTypeForTable(employmentType) {
  if (!employmentType) return '—';
  if (employmentType === 'DFOOP') return 'DFOOP';
  return SAFETY_DRIVER_EMPLOYMENT_LABELS[employmentType] || employmentType;
}

export const LOAD_STATUSES = ['open', 'active', 'delivered'];

export const LOAD_STATUS_LABELS = {
  open: 'Open',
  active: 'Active',
  delivered: 'Delivered',
};

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...EQUIPMENT_STATUSES.map((status) => ({ value: status, label: status })),
];
