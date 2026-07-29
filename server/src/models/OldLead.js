import mongoose from 'mongoose';
import {
  LEAD_STATUSES,
  DRIVER_TYPES,
  DEFAULT_LEAD_STATUS,
} from '../config/recruitingConstants.js';

const oldLeadAssignmentSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: { type: Date, required: true },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
  },
  { _id: false }
);

const oldLeadSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
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
    commentsText: { type: String, trim: true, default: '' },
    importedAt: { type: Date, default: null },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignment: { type: oldLeadAssignmentSchema, default: null },
  },
  { timestamps: true }
);

oldLeadSchema.index({ email: 1 });
oldLeadSchema.index({ phone: 1 });
oldLeadSchema.index({ lastName: 1, firstName: 1 });
oldLeadSchema.index({ createdAt: -1 });
oldLeadSchema.index({ 'assignment.recruiterId': 1 });

export const OldLead = mongoose.model('OldLead', oldLeadSchema);
