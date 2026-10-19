import { MaintenanceCase } from '../models/MaintenanceCase.js';
import { User } from '../models/User.js';
import { Truck } from '../models/Truck.js';
import { Trailer } from '../models/Trailer.js';
import { FileModel } from '../models/File.js';
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_OOS_STATUSES,
  MAINTENANCE_COMMENT_MAX_LENGTH,
} from '../config/maintenanceConstants.js';
import { ensureMaintenanceTag, getTagColorMap } from './maintenanceTagService.js';
import {
  canAssignMaintenanceCaseToAnyone,
} from '../utils/maintenancePermissions.js';
import { ensureMaintenanceCaseFolder } from './maintenanceCaseFolderService.js';
import {
  formatChicagoDisplay,
  chicagoStartOfDay,
  chicagoEndOfDay,
} from '../utils/chicagoTime.js';
import { resolveUploadDir, buildFileRelativePath } from './storageService.js';
import { sanitizeName } from '../config/storage.js';
import path from 'path';
import fs from 'fs/promises';
import { resolveFullPath } from '../config/storage.js';
import { pathExists } from './storageService.js';

const CASE_POPULATE = [
  { path: 'assigneeId', select: 'name email ringCentralExtensionNumber' },
  { path: 'truckId', select: 'truckNumber vin make model year type status' },
  { path: 'trailerId', select: 'trailerNumber vin make model year type status' },
  { path: 'createdBy', select: 'name' },
  { path: 'comments.author', select: 'name' },
  { path: 'attachments.fileId', select: 'originalName mimeType size relativePath' },
];

function touchLastEdited(maintenanceCase) {
  maintenanceCase.lastEditedAt = new Date();
}

async function validateAssignee(assigneeId) {
  if (!assigneeId) return null;
  const user = await User.findById(assigneeId);
  if (!user) {
    const err = new Error('Assignee not found');
    err.status = 404;
    throw err;
  }
  if (!user.isMaintenance && !user.isMaintenanceManager && user.role !== 'SUPER_ADMIN') {
    const err = new Error('Assignee must have maintenance role');
    err.status = 400;
    throw err;
  }
  return user._id;
}

async function resolveAssigneeIdForActor(actor, assigneeId) {
  const requested = assigneeId || null;

  if (canAssignMaintenanceCaseToAnyone(actor)) {
    return validateAssignee(requested);
  }

  if (!requested) {
    const err = new Error('You must assign this case to yourself');
    err.status = 403;
    throw err;
  }
  if (requested.toString() !== actor._id.toString()) {
    const err = new Error('You can only assign cases to yourself');
    err.status = 403;
    throw err;
  }
  return validateAssignee(requested);
}

async function validateAssets(truckId, trailerId) {
  if (!truckId && !trailerId) {
    const err = new Error('At least one truck or trailer is required');
    err.status = 400;
    throw err;
  }
  if (truckId) {
    const truck = await Truck.findById(truckId);
    if (!truck) {
      const err = new Error('Truck not found');
      err.status = 404;
      throw err;
    }
  }
  if (trailerId) {
    const trailer = await Trailer.findById(trailerId);
    if (!trailer) {
      const err = new Error('Trailer not found');
      err.status = 404;
      throw err;
    }
  }
}

async function syncTagFields(payload, userId) {
  const updates = {};
  if (payload.caseStatus !== undefined) {
    const value = String(payload.caseStatus || '').trim();
    if (value) await ensureMaintenanceTag('case_status', value, userId);
    updates.caseStatus = value;
  }
  if (payload.project !== undefined) {
    const value = String(payload.project || '').trim();
    if (value) await ensureMaintenanceTag('project', value, userId);
    updates.project = value;
  }
  if (payload.caseType !== undefined) {
    const value = String(payload.caseType || '').trim();
    if (value) await ensureMaintenanceTag('case_type', value, userId);
    updates.caseType = value;
  }
  if (payload.invoiceStatus !== undefined) {
    const value = String(payload.invoiceStatus || '').trim();
    if (value) await ensureMaintenanceTag('invoice_status', value, userId);
    updates.invoiceStatus = value;
  }
  if (payload.dispatchStatus !== undefined) {
    const value = String(payload.dispatchStatus || '').trim();
    if (value) await ensureMaintenanceTag('dispatch_status', value, userId);
    updates.dispatchStatus = value;
  }
  return updates;
}

function parseOptionalCost(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    const err = new Error('Invalid cost amount');
    err.status = 400;
    throw err;
  }
  return Math.round(num * 100) / 100;
}

function parseOptionalDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return chicagoStartOfDay(value.trim());
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error('Invalid date');
    err.status = 400;
    throw err;
  }
  return parsed;
}

export async function formatMaintenanceCase(record, tagColorMap) {
  const obj = record.toObject ? record.toObject() : record;
  const colorFor = (type, name) =>
    tagColorMap?.get(`${type}:${name}`) || '#94A3B8';

  const comments = [...(obj.comments || [])]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => ({
      id: c._id.toString(),
      text: c.text,
      author: c.author?.name || 'Unknown',
      authorId: c.author?._id?.toString() || c.author,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

  const latestComment = comments[0] || null;

  return {
    id: obj._id.toString(),
    issue: obj.issue,
    assigneeId: obj.assigneeId?._id?.toString() || obj.assigneeId || null,
    assigneeName: obj.assigneeId?.name || null,
    assigneeExtension: obj.assigneeId?.ringCentralExtensionNumber || null,
    dueDate: obj.dueDate,
    dueDateLabel: obj.dueDate ? formatChicagoDisplay(obj.dueDate).split(',')[0] : '',
    truckId: obj.truckId?._id?.toString() || obj.truckId || null,
    truckNumber: obj.truckId?.truckNumber || null,
    truckVin: obj.truckId?.vin || '',
    truckSpecs: [obj.truckId?.make, obj.truckId?.model, obj.truckId?.year]
      .filter(Boolean)
      .join(' '),
    trailerId: obj.trailerId?._id?.toString() || obj.trailerId || null,
    trailerNumber: obj.trailerId?.trailerNumber || null,
    trailerVin: obj.trailerId?.vin || '',
    trailerSpecs: [obj.trailerId?.make, obj.trailerId?.model, obj.trailerId?.year]
      .filter(Boolean)
      .join(' '),
    caseStatus: obj.caseStatus || '',
    caseStatusColor: colorFor('case_status', obj.caseStatus),
    priority: obj.priority,
    project: obj.project || '',
    projectColor: colorFor('project', obj.project),
    oosStatus: obj.oosStatus,
    caseType: obj.caseType || '',
    caseTypeColor: colorFor('case_type', obj.caseType),
    repairShop: obj.repairShop || '',
    issueDescription: obj.issueDescription || '',
    invoiceStatus: obj.invoiceStatus || '',
    invoiceStatusColor: colorFor('invoice_status', obj.invoiceStatus),
    dateClosed: obj.dateClosed,
    dateClosedLabel: obj.dateClosed ? formatChicagoDisplay(obj.dateClosed).split(',')[0] : '',
    dispatchStatus: obj.dispatchStatus || '',
    dispatchStatusColor: colorFor('dispatch_status', obj.dispatchStatus),
    cost: obj.cost ?? null,
    costLabel:
      obj.cost !== null && obj.cost !== undefined
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(obj.cost)
        : '',
    attachmentFolderId: obj.attachmentFolderId?.toString?.() || obj.attachmentFolderId || null,
    attachments: (obj.attachments || []).map((a) => ({
      id: a._id.toString(),
      fileId: a.fileId?._id?.toString() || a.fileId,
      originalName: a.originalName || a.fileId?.originalName || 'file',
      mimeType: a.fileId?.mimeType || '',
      size: a.fileId?.size || 0,
      uploadedAt: a.createdAt,
    })),
    comments,
    latestCommentPreview: latestComment?.text || '',
    lastEditedAt: obj.lastEditedAt,
    lastEditedAtLabel: formatChicagoDisplay(obj.lastEditedAt),
    createdAt: obj.createdAt,
    createdByName: obj.createdBy?.name || null,
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseQueryStringList(value) {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
}

function applyDateRange(and, field, from, to) {
  const range = {};
  if (from) {
    const start = parseOptionalDate(from);
    if (start) range.$gte = start;
  }
  if (to) {
    const end =
      typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to.trim())
        ? chicagoEndOfDay(to.trim())
        : parseOptionalDate(to);
    if (end) range.$lte = end;
  }
  if (Object.keys(range).length) {
    and.push({ [field]: range });
  }
}

async function buildMaintenanceCaseListFilter(query = {}) {
  const and = [];

  const issueText = String(query.issue || query.search || '').trim();
  if (issueText) {
    const regex = new RegExp(escapeRegex(issueText), 'i');
    and.push({ $or: [{ issue: regex }, { issueDescription: regex }] });
  }

  const assigneeId = String(query.assigneeId || '').trim();
  if (assigneeId === 'unassigned') {
    and.push({ $or: [{ assigneeId: null }, { assigneeId: { $exists: false } }] });
  } else if (assigneeId) {
    and.push({ assigneeId });
  }

  applyDateRange(and, 'dueDate', query.dueFrom, query.dueTo);
  applyDateRange(and, 'dateClosed', query.dateClosedFrom, query.dateClosedTo);
  applyDateRange(and, 'lastEditedAt', query.lastEditedFrom, query.lastEditedTo);

  const shop = String(query.repairShop || '').trim();
  if (shop) {
    and.push({ repairShop: new RegExp(escapeRegex(shop), 'i') });
  }

  const caseStatuses = parseQueryStringList(query.caseStatus);
  if (caseStatuses.length) {
    and.push({
      $or: caseStatuses.map((status) => ({
        caseStatus: new RegExp(`^${escapeRegex(status)}$`, 'i'),
      })),
    });
  }

  const priorities = parseQueryStringList(query.priority);
  if (priorities.length) and.push({ priority: { $in: priorities } });

  const projects = parseQueryStringList(query.project);
  if (projects.length) and.push({ project: { $in: projects } });

  const oosStatuses = parseQueryStringList(query.oosStatus);
  if (oosStatuses.length) and.push({ oosStatus: { $in: oosStatuses } });

  const caseTypes = parseQueryStringList(query.caseType);
  if (caseTypes.length) and.push({ caseType: { $in: caseTypes } });

  const invoiceStatuses = parseQueryStringList(query.invoiceStatus);
  if (invoiceStatuses.length) and.push({ invoiceStatus: { $in: invoiceStatuses } });

  const dispatchStatuses = parseQueryStringList(query.dispatchStatus);
  if (dispatchStatuses.length) and.push({ dispatchStatus: { $in: dispatchStatuses } });

  const costMinRaw = query.costMin;
  const costMaxRaw = query.costMax;
  const costMin =
    costMinRaw !== undefined && costMinRaw !== '' ? Number(costMinRaw) : null;
  const costMax =
    costMaxRaw !== undefined && costMaxRaw !== '' ? Number(costMaxRaw) : null;
  if (
    (costMin !== null && Number.isFinite(costMin)) ||
    (costMax !== null && Number.isFinite(costMax))
  ) {
    const costRange = {};
    if (costMin !== null && Number.isFinite(costMin)) costRange.$gte = costMin;
    if (costMax !== null && Number.isFinite(costMax)) costRange.$lte = costMax;
    and.push({ cost: costRange });
  }

  const hasCost = String(query.hasCost || '').toLowerCase();
  if (hasCost === 'yes') {
    and.push({ cost: { $ne: null } });
  } else if (hasCost === 'no') {
    and.push({ $or: [{ cost: null }, { cost: { $exists: false } }] });
  }

  const equipment = String(query.equipment || '').trim();
  if (equipment) {
    const regex = new RegExp(escapeRegex(equipment), 'i');
    const [trucks, trailers] = await Promise.all([
      Truck.find({ truckNumber: regex }).select('_id').limit(100),
      Trailer.find({ trailerNumber: regex }).select('_id').limit(100),
    ]);
    const equipmentOr = [];
    if (trucks.length) equipmentOr.push({ truckId: { $in: trucks.map((t) => t._id) } });
    if (trailers.length) equipmentOr.push({ trailerId: { $in: trailers.map((t) => t._id) } });
    if (!equipmentOr.length) {
      and.push({ _id: { $in: [] } });
    } else {
      and.push({ $or: equipmentOr });
    }
  }

  if (!and.length) return {};
  return and.length === 1 ? and[0] : { $and: and };
}

export async function listMaintenanceCases(query = {}) {
  const pageNum = Math.max(1, Number(query.page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const filter = await buildMaintenanceCaseListFilter(query);

  const skip = (pageNum - 1) * limitNum;
  const [records, total] = await Promise.all([
    MaintenanceCase.find(filter)
      .populate(CASE_POPULATE)
      .sort({ lastEditedAt: -1 })
      .skip(skip)
      .limit(limitNum),
    MaintenanceCase.countDocuments(filter),
  ]);

  const tagColorMap = await getTagColorMap();
  const cases = await Promise.all(records.map((r) => formatMaintenanceCase(r, tagColorMap)));

  return {
    cases,
    total,
    page: pageNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  };
}

export async function getMaintenanceCaseById(id) {
  const record = await MaintenanceCase.findById(id).populate(CASE_POPULATE);
  if (!record) {
    const err = new Error('Maintenance case not found');
    err.status = 404;
    throw err;
  }
  const tagColorMap = await getTagColorMap();
  return formatMaintenanceCase(record, tagColorMap);
}

export async function createMaintenanceCase(payload, user) {
  const issue = String(payload.issue || '').trim();
  if (!issue) {
    const err = new Error('Issue is required');
    err.status = 400;
    throw err;
  }

  const truckId = payload.truckId || null;
  const trailerId = payload.trailerId || null;
  await validateAssets(truckId, trailerId);

  if (payload.priority && !MAINTENANCE_PRIORITIES.includes(payload.priority)) {
    const err = new Error('Invalid priority');
    err.status = 400;
    throw err;
  }
  if (payload.oosStatus && !MAINTENANCE_OOS_STATUSES.includes(payload.oosStatus)) {
    const err = new Error('Invalid OOS status');
    err.status = 400;
    throw err;
  }

  const assigneeId = await resolveAssigneeIdForActor(user, payload.assigneeId || null);
  const tagFields = await syncTagFields(payload, user._id);

  const maintenanceCase = await MaintenanceCase.create({
    issue,
    assigneeId,
    dueDate: parseOptionalDate(payload.dueDate),
    truckId,
    trailerId,
    priority: payload.priority || 'Normal',
    oosStatus: payload.oosStatus || 'In Service',
    repairShop: String(payload.repairShop || '').trim(),
    issueDescription: String(payload.issueDescription || '').trim(),
    dateClosed: parseOptionalDate(payload.dateClosed),
    cost: parseOptionalCost(payload.cost),
    ...tagFields,
    createdBy: user._id,
    lastEditedAt: new Date(),
  });

  const folderId = await ensureMaintenanceCaseFolder({
    truckId,
    trailerId,
    caseId: maintenanceCase._id,
    user,
  });
  if (folderId) {
    maintenanceCase.attachmentFolderId = folderId;
    await maintenanceCase.save();
  }

  return getMaintenanceCaseById(maintenanceCase._id);
}

export async function updateMaintenanceCase(id, payload, user) {
  const maintenanceCase = await MaintenanceCase.findById(id);
  if (!maintenanceCase) {
    const err = new Error('Maintenance case not found');
    err.status = 404;
    throw err;
  }

  if (payload.issue !== undefined) {
    const issue = String(payload.issue || '').trim();
    if (!issue) {
      const err = new Error('Issue is required');
      err.status = 400;
      throw err;
    }
    maintenanceCase.issue = issue;
  }

  if (payload.truckId !== undefined || payload.trailerId !== undefined) {
    const truckId =
      payload.truckId !== undefined ? payload.truckId || null : maintenanceCase.truckId;
    const trailerId =
      payload.trailerId !== undefined ? payload.trailerId || null : maintenanceCase.trailerId;
    await validateAssets(truckId, trailerId);
    maintenanceCase.truckId = truckId;
    maintenanceCase.trailerId = trailerId;
  }

  if (payload.assigneeId !== undefined) {
    maintenanceCase.assigneeId = await resolveAssigneeIdForActor(
      user,
      payload.assigneeId || null
    );
  }
  if (payload.dueDate !== undefined) {
    maintenanceCase.dueDate = parseOptionalDate(payload.dueDate);
  }
  if (payload.dateClosed !== undefined) {
    maintenanceCase.dateClosed = parseOptionalDate(payload.dateClosed);
  }
  if (payload.priority !== undefined) {
    if (!MAINTENANCE_PRIORITIES.includes(payload.priority)) {
      const err = new Error('Invalid priority');
      err.status = 400;
      throw err;
    }
    maintenanceCase.priority = payload.priority;
  }
  if (payload.oosStatus !== undefined) {
    if (!MAINTENANCE_OOS_STATUSES.includes(payload.oosStatus)) {
      const err = new Error('Invalid OOS status');
      err.status = 400;
      throw err;
    }
    maintenanceCase.oosStatus = payload.oosStatus;
  }
  if (payload.repairShop !== undefined) {
    maintenanceCase.repairShop = String(payload.repairShop || '').trim();
  }
  if (payload.issueDescription !== undefined) {
    maintenanceCase.issueDescription = String(payload.issueDescription || '').trim();
  }
  if (payload.cost !== undefined) {
    maintenanceCase.cost = parseOptionalCost(payload.cost);
  }

  const tagFields = await syncTagFields(payload, user._id);
  Object.assign(maintenanceCase, tagFields);

  if (!maintenanceCase.attachmentFolderId) {
    const folderId = await ensureMaintenanceCaseFolder({
      truckId: maintenanceCase.truckId,
      trailerId: maintenanceCase.trailerId,
      caseId: maintenanceCase._id,
      user,
    });
    if (folderId) maintenanceCase.attachmentFolderId = folderId;
  }

  touchLastEdited(maintenanceCase);
  await maintenanceCase.save();
  return getMaintenanceCaseById(maintenanceCase._id);
}

export async function deleteMaintenanceCase(id) {
  const record = await MaintenanceCase.findByIdAndDelete(id);
  if (!record) {
    const err = new Error('Maintenance case not found');
    err.status = 404;
    throw err;
  }
  return { id: record._id.toString() };
}

export async function addMaintenanceCaseComment(id, text, user) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.length > MAINTENANCE_COMMENT_MAX_LENGTH) {
    const err = new Error(`Comment must be 1-${MAINTENANCE_COMMENT_MAX_LENGTH} characters`);
    err.status = 400;
    throw err;
  }

  const maintenanceCase = await MaintenanceCase.findById(id);
  if (!maintenanceCase) {
    const err = new Error('Maintenance case not found');
    err.status = 404;
    throw err;
  }

  maintenanceCase.comments.push({
    text: trimmed,
    author: user._id,
    authorLabel: user.name,
  });
  touchLastEdited(maintenanceCase);
  await maintenanceCase.save();
  return getMaintenanceCaseById(id);
}

export async function addMaintenanceCaseAttachment(id, file, user) {
  const maintenanceCase = await MaintenanceCase.findById(id);
  if (!maintenanceCase) {
    const err = new Error('Maintenance case not found');
    err.status = 404;
    throw err;
  }

  if (!maintenanceCase.attachmentFolderId) {
    const folderId = await ensureMaintenanceCaseFolder({
      truckId: maintenanceCase.truckId,
      trailerId: maintenanceCase.trailerId,
      caseId: maintenanceCase._id,
      user,
    });
    if (!folderId) {
      const err = new Error(
        'Link a folder to the truck or trailer before uploading attachments'
      );
      err.status = 400;
      throw err;
    }
    maintenanceCase.attachmentFolderId = folderId;
  }

  const folderId = maintenanceCase.attachmentFolderId;
  const { relativePath, fullPath } = await resolveUploadDir(folderId, null);
  const storedName = sanitizeName(
    `${Date.now()}-${file.originalname || 'upload'}`.replace(/\s+/g, '-')
  );
  const destPath = path.join(fullPath, storedName);
  await fs.writeFile(destPath, file.buffer);

  const fileRecord = await FileModel.create({
    filename: storedName,
    originalName: file.originalname || storedName,
    relativePath: buildFileRelativePath(relativePath, storedName),
    folderId,
    subfolderId: null,
    uploadedBy: user._id,
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.size || 0,
  });

  maintenanceCase.attachments.push({
    fileId: fileRecord._id,
    originalName: fileRecord.originalName,
    uploadedBy: user._id,
  });
  touchLastEdited(maintenanceCase);
  await maintenanceCase.save();
  return getMaintenanceCaseById(id);
}

export async function getMaintenanceCaseAttachmentFile(caseId, fileId) {
  const maintenanceCase = await MaintenanceCase.findById(caseId);
  if (!maintenanceCase) {
    const err = new Error('Maintenance case not found');
    err.status = 404;
    throw err;
  }

  const attachment = maintenanceCase.attachments.find(
    (entry) => entry.fileId?.toString() === String(fileId)
  );
  if (!attachment) {
    const err = new Error('Attachment not found on this case');
    err.status = 404;
    throw err;
  }

  const file = await FileModel.findById(fileId);
  if (!file) {
    const err = new Error('File not found');
    err.status = 404;
    throw err;
  }

  if (!(await pathExists(file.relativePath))) {
    const err = new Error('File not found on disk');
    err.status = 404;
    throw err;
  }

  return file;
}

function formatAssigneeUser(u) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    extension: u.ringCentralExtensionNumber || null,
  };
}

export async function listMaintenanceAssignees(actor) {
  const users = await User.find({
    $or: [{ isMaintenance: true }, { isMaintenanceManager: true }, { role: 'SUPER_ADMIN' }],
  })
    .select('name email ringCentralExtensionNumber isMaintenance isMaintenanceManager role')
    .sort({ name: 1 });

  if (canAssignMaintenanceCaseToAnyone(actor)) {
    return users.map(formatAssigneeUser);
  }

  const selfId = actor._id.toString();
  const self = users.find((u) => u._id.toString() === selfId);
  if (self) {
    return [formatAssigneeUser(self)];
  }

  return [
    {
      id: selfId,
      name: actor.name,
      email: actor.email,
      extension: actor.ringCentralExtensionNumber || null,
    },
  ];
}
