import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const previewRowSchema = new mongoose.Schema(
  {
    rowNumber: { type: Number, required: true },
    status: String,
    driverType: String,
    source: String,
    date: String,
    firstName: String,
    lastName: String,
    phone: String,
    stateCity: String,
    email: String,
    comments: String,
    resolvedStatus: String,
    resolvedDriverType: String,
    resolvedSource: String,
    normalizedEmail: String,
    normalizedPhone: String,
    parsedCreatedAt: Date,
    errors: [String],
    warnings: [String],
    isValid: Boolean,
    isDuplicate: Boolean,
    duplicateReason: String,
    defaultSelected: Boolean,
  },
  { _id: false }
);

const leadImportPreviewSchema = new mongoose.Schema(
  {
    previewId: { type: String, required: true, unique: true, default: () => randomUUID() },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: { type: String, default: '' },
    assignedRecruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rows: [previewRowSchema],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 2 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

export const LeadImportPreview = mongoose.model('LeadImportPreview', leadImportPreviewSchema);
