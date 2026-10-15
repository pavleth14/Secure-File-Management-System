import mongoose from 'mongoose';
import { MAINTENANCE_TAG_TYPES } from '../config/maintenanceConstants.js';

const maintenanceCaseTagSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: MAINTENANCE_TAG_TYPES,
      required: true,
    },
    name: { type: String, required: true, trim: true },
    color: { type: String, trim: true, default: '#94A3B8' },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

maintenanceCaseTagSchema.index({ type: 1, name: 1 }, { unique: true });

export const MaintenanceCaseTag = mongoose.model('MaintenanceCaseTag', maintenanceCaseTagSchema);
