export const LEAD_STATUSES = [
  'Approved',
  'Attempting',
  "Couldn't Reach",
  'Female',
  'Hired',
  'Invalid Lead',
  'Local Driver',
  'New Lead',
  'No Experience',
  'Not Interested',
  'Processing',
  'Rejected',
  'SAP',
];

/** Recruiter-side disqualification statuses for analytics. */
export const RECRUITER_DISQUALIFICATION_STATUSES = [
  "Couldn't Reach",
  'Female',
  'Invalid Lead',
  'Local Driver',
  'No Experience',
  'Not Interested',
  'SAP',
];

/** Safety-side disqualification statuses for analytics. */
export const SAFETY_DISQUALIFICATION_STATUSES = ['Rejected'];

export const REMOVED_LEAD_STATUSES = [
  'Considering The Offer',
  'Not Approved',
  'Pending',
  'Unreachable',
];

export const DEFAULT_STATUS_COLOR = '#94A3B8';

/** Default color for system statuses on first insert only (when color is missing). */
export const DEFAULT_SYSTEM_STATUS_COLORS = {
  'New Lead': '#3B82F6',
  Attempting: '#F59E0B',
  Processing: '#F59E0B',
  Approved: '#22C55E',
  Rejected: '#EF4444',
  'Not Interested': '#EF4444',
  Hired: '#14B8A6',
  Female: '#EC4899',
  'Invalid Lead': '#64748B',
  'No Experience': '#64748B',
  SAP: '#64748B',
  'Local Driver': '#64748B',
  "Couldn't Reach": '#64748B',
};

/** Default isActive for system statuses on first insert only. */
export const DEFAULT_SYSTEM_STATUS_ACTIVITY = {
  'New Lead': true,
  Attempting: true,
  Processing: true,
  Approved: true,
  Rejected: false,
  'Not Interested': false,
  Hired: false,
  Female: false,
  'Invalid Lead': false,
  'No Experience': false,
  SAP: false,
  'Local Driver': false,
  "Couldn't Reach": false,
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

export const PROCESSING_STEPS = [
  { key: 'screening_started', label: 'Screening started (app/docs received)' },
  { key: 'clearing_house', label: 'Clearing house' },
  { key: 'criminal_background', label: 'Criminal background' },
  { key: 'cdl_scan', label: 'CDL scan' },
  { key: 'safety_processing', label: 'Safety processing (MVR/PSP)' },
  { key: 'drug_test', label: 'Drug test' },
  { key: 'orientation', label: 'Orientation' },
  { key: 'hired', label: 'Hired' },
];

export const PROCESSING_STEP_KEYS = PROCESSING_STEPS.map((step) => step.key);

export const PROCESSING_STEP_HIRED_KEY = 'hired';
