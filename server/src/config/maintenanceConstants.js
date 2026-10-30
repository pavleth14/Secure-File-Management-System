export const MAINTENANCE_TAG_TYPES = Object.freeze([
  'case_status',
  'project',
  'case_type',
  'invoice_status',
  'dispatch_status',
]);

export const MAINTENANCE_PRIORITIES = Object.freeze(['Low', 'Normal', 'High', 'Critical']);

export const MAINTENANCE_OOS_STATUSES = Object.freeze([
  'Out Of Service',
  'In Service',
  'Pending Verification',
  'Return To Service',
]);

/** Default project filter / case options (weekly reporting). */
export const MAINTENANCE_DEFAULT_PROJECTS = Object.freeze([
  'OTR',
  'Aljaska',
  'Montana',
  'KY',
  'NJ',
]);

export const MAINTENANCE_COMMENT_MAX_LENGTH = 2000;
export const MAINTENANCE_ISSUE_MAX_LENGTH = 200;
export const MAINTENANCE_DESCRIPTION_MAX_LENGTH = 8000;
