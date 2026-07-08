export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
};

export const PERMISSIONS = {
  READ: 'READ',
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
  MOVE: 'MOVE',
  FOLDER_CREATE: 'FOLDER_CREATE',
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const GROUP_NAMES = ['eld', 'dispatch', 'safety', 'maintenance'];

export const ROOT_FOLDER_NAMES = [
  'folder1',
  'folder2',
  'folder3',
  'folder4',
  'folder5',
];

// Roles permitted to access the registration endpoint. SUPER_ADMIN is always
// allowed; ADMIN is configurable via ALLOW_ADMIN_REGISTER (defaults to enabled).
// Normal users can never register accounts.
export const REGISTRATION_ALLOWED_ROLES = [
  ROLES.SUPER_ADMIN,
  ...(process.env.ALLOW_ADMIN_REGISTER === 'false' ? [] : [ROLES.ADMIN]),
];

export const ACCESS_TOKEN_EXPIRY = '15m';
export const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

export const MY_FILES_STORAGE_LIMIT = 50 * 1024 * 1024 * 1024;
export const USER_STORAGE_DISPLAY_LIMIT =
  Number(process.env.USER_STORAGE_LIMIT) || 55 * 1024 * 1024 * 1024;

export const FILE_SOURCE_TYPES = {
  GROUP: 'group',
  PERSONAL: 'personal',
  FOLDER: 'folder',
};
