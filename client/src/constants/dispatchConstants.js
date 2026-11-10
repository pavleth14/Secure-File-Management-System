export const EQUIPMENT_STATUSES = ['Active', 'Terminated', 'Not Active'];

export const DRIVER_TYPES = ['Solo', 'Team'];

/** Safety driver table Type column: company vs owner-operator. */
export function formatDriverEmploymentType(isOwnerOperator) {
  return isOwnerOperator ? 'Owner Operator' : 'Company Driver';
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
