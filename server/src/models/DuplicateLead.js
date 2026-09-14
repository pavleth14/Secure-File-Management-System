import mongoose from 'mongoose';
import { DRIVER_TYPES } from '../config/recruitingConstants.js';

const duplicateLeadSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    phoneDigits: { type: String, trim: true, default: '', index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    stateCity: { type: String, trim: true, default: '' },
    driverType: { type: String, enum: DRIVER_TYPES, default: 'Solo' },
    source: { type: String, trim: true, default: '' },
    date: { type: String, trim: true, default: '' },
    duplicateReason: { type: String, enum: ['email', 'phone'], required: true },
    contactKey: { type: String, required: true, trim: true, index: true },
    matchedLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    ingestionSource: {
      type: String,
      enum: ['manual', 'sheets', 'csv_import', 'old_lead'],
      required: true,
    },
    ingestionMeta: { type: mongoose.Schema.Types.Mixed, default: null },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'duplicateleads' }
);

duplicateLeadSchema.index({ contactKey: 1, receivedAt: -1 });

export const DuplicateLead = mongoose.model('DuplicateLead', duplicateLeadSchema);
