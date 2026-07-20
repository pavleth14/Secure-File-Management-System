import mongoose from 'mongoose';
import {
  LEAD_STATUSES,
  DRIVER_TYPES,
  DEFAULT_LEAD_STATUS,
} from '../config/recruitingConstants.js';

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

const leadSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    stateCity: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: DEFAULT_LEAD_STATUS,
    },
    driverType: {
      type: String,
      enum: DRIVER_TYPES,
      required: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    date: { type: String, trim: true, default: '' },
    importedAt: { type: Date, default: null },
    assignedRecruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    comments: [commentSchema],
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

leadSchema.index({ assignedRecruiter: 1, archived: 1, createdAt: -1 });
leadSchema.index({ archived: 1, archivedAt: -1 });
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ lastName: 1, firstName: 1 });

export const Lead = mongoose.model('Lead', leadSchema);
