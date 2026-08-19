import mongoose from 'mongoose';
import {
  DRIVER_TYPES,
  DEFAULT_LEAD_STATUS,
} from '../config/recruitingConstants.js';
import { normalizeUsPhoneDigits } from '../utils/usPhone.js';

const ringCentralEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['call', 'sms'], required: true },
    direction: { type: String, enum: ['Inbound', 'Outbound'], required: true },
    durationSec: { type: Number, default: 0 },
    result: { type: String, trim: true, default: '' },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    ringCentralEventId: { type: String, required: true, trim: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    authorLabel: { type: String, trim: true, default: null },
    extensionId: { type: String, trim: true, default: null },
    callLogSynced: { type: Boolean, default: false },
    isSystem: { type: Boolean, default: true },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorLabel: { type: String, default: null },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const processingStepHistorySchema = new mongoose.Schema(
  {
    stepKey: { type: String, required: true, trim: true },
    savedAt: { type: Date, required: true },
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: false }
);

const leadSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    phoneDigits: { type: String, trim: true, default: '', index: true },
    firstCalledAt: { type: Date, default: null },
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
      default: DEFAULT_LEAD_STATUS,
    },
    rejectionReason: { type: String, trim: true, default: null },
    processingStep: { type: String, trim: true, default: null },
    processingStepIndex: { type: Number, default: null },
    processingStepHistory: { type: [processingStepHistorySchema], default: [] },
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
    ringCentralEvents: [ringCentralEventSchema],
    extraFields: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

leadSchema.index({ assignedRecruiter: 1, archived: 1, createdAt: -1 });
leadSchema.index({ archived: 1, archivedAt: -1 });
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ lastName: 1, firstName: 1 });
leadSchema.index({ 'ringCentralEvents.ringCentralEventId': 1 });

leadSchema.pre('save', function syncPhoneDigits(next) {
  if (this.isModified('phone') || !this.phoneDigits) {
    this.phoneDigits = normalizeUsPhoneDigits(this.phone);
  }
  next();
});

export const Lead = mongoose.model('Lead', leadSchema);
