import { FileModel } from '../models/File.js';
import { PersonalFile } from '../models/PersonalFile.js';
import { AuditLog } from '../models/AuditLog.js';
import { AUDIT_ACTIONS, TARGET_TYPES } from '../config/auditConstants.js';
import { FILE_SOURCE_TYPES, MY_FILES_STORAGE_LIMIT } from '../config/constants.js';
import { getMyFilesStorageUsed } from './myFilesService.js';
import { listFavorites } from './favoritesService.js';

const RECENT_LIMIT = 10;

const ADDED_ACTIONS = [AUDIT_ACTIONS.FILE_UPLOAD, AUDIT_ACTIONS.MY_FILE_UPLOAD];
const DELETED_ACTIONS = [AUDIT_ACTIONS.FILE_DELETE, AUDIT_ACTIONS.MY_FILE_DELETE];
const OPENED_ACTIONS = [
  AUDIT_ACTIONS.FILE_READ,
  AUDIT_ACTIONS.FILE_DOWNLOAD,
  AUDIT_ACTIONS.MY_FILE_READ,
  AUDIT_ACTIONS.MY_FILE_DOWNLOAD,
];

function mapGroupFile(file) {
  return {
    id: file._id,
    fileType: FILE_SOURCE_TYPES.GROUP,
    name: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
    createdAt: file.createdAt,
    folderId: file.folderId,
    subfolderId: file.subfolderId,
  };
}

async function getRecentlyAdded(userId) {
  const [groupFiles, personalFiles] = await Promise.all([
    FileModel.find({ uploadedBy: userId })
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    PersonalFile.find({ userId })
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
  ]);

  const combined = [
    ...groupFiles.map((file) => mapGroupFile(file)),
    ...personalFiles.map((file) => ({
      id: file._id,
      fileType: FILE_SOURCE_TYPES.PERSONAL,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      createdAt: file.createdAt,
    })),
  ];

  return combined
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, RECENT_LIMIT);
}

async function getRecentFromAudit(userId, actions) {
  const logs = await AuditLog.find({
    userId,
    action: { $in: actions },
    targetType: { $in: [TARGET_TYPES.FILE, TARGET_TYPES.PERSONAL_FILE] },
  })
    .sort({ timestamp: -1 })
    .limit(RECENT_LIMIT)
    .lean();

  return logs.map((log) => ({
    id: log.targetId,
    fileType:
      log.targetType === TARGET_TYPES.PERSONAL_FILE
        ? FILE_SOURCE_TYPES.PERSONAL
        : FILE_SOURCE_TYPES.GROUP,
    name: log.targetName,
    timestamp: log.timestamp,
    action: log.action,
  }));
}

async function getStorageUsage(userId) {
  const usedBytes = await getMyFilesStorageUsed(userId);
  const limitBytes = MY_FILES_STORAGE_LIMIT;
  const percentage = limitBytes ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  return {
    usedBytes,
    limitBytes,
    percentage: Math.round(percentage * 10) / 10,
  };
}

export async function getDashboardData(user) {
  const [recentAdded, recentDeleted, recentOpened, favorites, storage] =
    await Promise.all([
      getRecentlyAdded(user._id),
      getRecentFromAudit(user._id, DELETED_ACTIONS),
      getRecentFromAudit(user._id, OPENED_ACTIONS),
      listFavorites(user),
      getStorageUsage(user._id),
    ]);

  return {
    recentAdded,
    recentDeleted,
    recentOpened,
    favorites,
    storage,
  };
}
