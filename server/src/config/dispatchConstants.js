export const EQUIPMENT_STATUSES = Object.freeze(['Active', 'Terminated', 'Not Active']);

export const DRIVER_TYPES = Object.freeze(['Solo', 'Team']);

export const ASSIGNMENT_HISTORY_ACTIONS = Object.freeze([
  'created',
  'driver_assigned',
  'co_driver_assigned',
  'dispatcher_assigned',
  'driver_removed',
  'co_driver_removed',
  'dispatcher_removed',
  'updated',
]);

export const LOAD_STATUSES = Object.freeze(['open', 'active', 'delivered']);

export const DISPATCH_TIMEZONE = 'America/Chicago';

export const MAX_LOAD_COMMENT_LENGTH = 2000;

export const LOAD_COMMENT_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
