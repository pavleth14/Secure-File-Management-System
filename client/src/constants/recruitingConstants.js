export const LEAD_STATUSES = [
  'Attempting',
  'Pending',
  'Not Approved',
  'Rejected',
  'SAP',
  'No Experience',
  'Unreachable',
  'Invalid Lead',
  'Approved',
  'Hired',
  'Female',
  'Considering The Offer',
  'Not Interested',
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

export const LEAD_PERSONAL_INFO_EDIT_WINDOW_MS =  24 * 60 * 60 * 1000; // 5 minutes

export const LEAD_COMMENT_EDIT_WINDOW_MS = 8 * 60 * 60 * 1000;

export const LEAD_BOARD_PAGE_SIZES = [25, 50, 100];

export const LEAD_DATE_PRESETS = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];
