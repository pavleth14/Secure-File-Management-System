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

export const DRIVER_TYPES = ['Local', 'Solo', 'Team', 'Owner Operator'];

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

export const LEAD_BOARD_PAGE_SIZES = [25, 50, 100];

export const LEAD_DATE_PRESETS = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

export const LEAD_ACTIVITY_GROUPS = [
  { value: 'active', label: 'Active' },
  { value: 'non-active', label: 'Non-active' },
  { value: 'all', label: 'All' },
];

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
