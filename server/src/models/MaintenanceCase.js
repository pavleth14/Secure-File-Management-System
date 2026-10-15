import mongoose from 'mongoose';
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_OOS_STATUSES,
} from '../config/maintenanceConstants.js';

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorLabel: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const attachmentSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
    },
    originalName: { type: String, trim: true, default: '' },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const maintenanceCaseSchema = new mongoose.Schema(
  {
    issue: { type: String, required: true, trim: true, maxlength: 200 },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    dueDate: { type: Date, default: null },
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
      default: null,
    },
    trailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trailer',
      default: null,
    },
    caseStatus: { type: String, trim: true, default: '' },
    priority: {
      type: String,
      enum: MAINTENANCE_PRIORITIES,
      default: 'Normal',
    },
    project: { type: String, trim: true, default: '' },
    oosStatus: {
      type: String,
      enum: MAINTENANCE_OOS_STATUSES,
      default: 'In Service',
    },
    caseType: { type: String, trim: true, default: '' },
    repairShop: { type: String, trim: true, default: '' },
    issueDescription: { type: String, trim: true, default: '' },
    invoiceStatus: { type: String, trim: true, default: '' },
    dateClosed: { type: Date, default: null },
    dispatchStatus: { type: String, trim: true, default: '' },
    attachmentFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    attachments: { type: [attachmentSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    lastEditedAt: { type: Date, default: () => new Date() },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

maintenanceCaseSchema.index({ lastEditedAt: -1 });
maintenanceCaseSchema.index({ dueDate: 1 });
maintenanceCaseSchema.index({ truckId: 1 });
maintenanceCaseSchema.index({ trailerId: 1 });

export const MaintenanceCase = mongoose.model('MaintenanceCase', maintenanceCaseSchema);
