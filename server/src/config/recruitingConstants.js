export const LEAD_STATUSES = [
  'Approved',
  'Attempting',
  'Female',
  'Hired',
  'Invalid Lead',
  'Local Driver',
  'New Lead',
  'No Experience',
  'Processing',
  'Rejected',
  'SAP',
];

export const REMOVED_LEAD_STATUSES = [
  'Considering The Offer',
  'Not Approved',
  'Not Interested',
  'Pending',
  'Unreachable',
];

/** Default isActive for system statuses on first insert only. */
export const DEFAULT_SYSTEM_STATUS_ACTIVITY = {
  'New Lead': true,
  Attempting: true,
  Processing: true,
  Approved: true,
  Rejected: false,
  Hired: false,
  Female: false,
  'Invalid Lead': false,
  'No Experience': false,
  SAP: false,
  'Local Driver': false,
};

export const DRIVER_TYPES = ['Local', 'Solo', 'Team', 'Owner Operator'];

/** Default round-robin driver types for existing recruiters on first migration. */
export const DEFAULT_OTR_ROUND_ROBIN_DRIVER_TYPES = ['Solo', 'Team', 'Owner Operator'];

export const LEAD_SOURCES = [
  'Facebook',
  'Indeed',
  'Hiring Call',
  'Old Leads',
  'Tenstreet',
  'Craigslist',
  'Planet L',
  'Hiring Open',
  'Website',
];

export const LEAD_PERSONAL_INFO_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LEAD_COMMENT_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_LEAD_STATUS = 'New Lead';

export const REJECTION_REASONS = [
  'Excessive Moving Violations',
  'Major Preventable Accidents',
  'Failed Drug or Alcohol Screening',
  'Disqualifying License Status (CDL/MVR)',
  'Does Not Meet Company Safety Standards',
  'SAP',
  'Bad VOE',
  'DUI / DWI History',
  'Bad criminal record',
  'Not enough experience',
  "Doesn't speak English",
];

export const REJECTION_REASON_CUSTOM = 'Custom (nothing from above applies)';
