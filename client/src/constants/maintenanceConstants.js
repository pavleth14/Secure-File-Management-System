export const MAINTENANCE_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'];

export const MAINTENANCE_OOS_STATUSES = [
  'Out Of Service',
  'In Service',
  'Pending Verification',
  'Return To Service',
];

export const MAINTENANCE_TAG_TYPES = {
  caseStatus: 'case_status',
  project: 'project',
  caseType: 'case_type',
  invoiceStatus: 'invoice_status',
  dispatchStatus: 'dispatch_status',
};

export const MAINTENANCE_DEFAULT_PROJECTS = ['OTR', 'Montana', 'KY', 'NJ'];

export const MAINTENANCE_PARKING_STATUSES = [
  'Picked up',
  'Extended',
  'Canceled',
  'Local Weekly',
  'Local Monthly',
  'OTR',
];

export const MAINTENANCE_PARKING_UNIT_SCOPES = [
  { value: 'truck', label: 'Truck' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'truck_trailer', label: 'Truck + trailer' },
];
