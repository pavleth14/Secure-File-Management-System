import mongoose from 'mongoose';
import {
  DRIVER_TYPES,
  EQUIPMENT_STATUSES,
  SAFETY_DRIVER_EMPLOYMENT_TYPES,
} from '../config/dispatchConstants.js';

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    driverType: {
      type: String,
      enum: DRIVER_TYPES,
      default: 'Solo',
    },
    isOwnerOperator: { type: Boolean, default: false },
    employmentType: {
      type: String,
      enum: SAFETY_DRIVER_EMPLOYMENT_TYPES,
      default: 'Company Driver',
    },
    dateOfBirth: { type: Date, default: null },
    ssn: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    hiredDate: { type: Date, default: null },
    status: {
      type: String,
      enum: EQUIPMENT_STATUSES,
      default: 'Active',
    },
    cdlNumber: { type: String, default: '', trim: true },
    cdlState: { type: String, default: '', trim: true },
    cdlExpiration: { type: Date, default: null },
    linkedFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    importSheetOrder: { type: Number, default: null },
  },
  { timestamps: true }
);

driverSchema.index({ status: 1, name: 1 });
driverSchema.index({ importSheetOrder: 1 });

export const Driver = mongoose.model('Driver', driverSchema);
