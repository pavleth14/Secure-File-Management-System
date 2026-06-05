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

export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
