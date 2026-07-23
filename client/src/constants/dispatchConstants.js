export const EQUIPMENT_STATUSES = ['Active', 'Terminated', 'Not Active'];

export const DRIVER_TYPES = ['Solo', 'Team'];

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...EQUIPMENT_STATUSES.map((status) => ({ value: status, label: status })),
];
