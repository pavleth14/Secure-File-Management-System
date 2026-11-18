import mongoose from 'mongoose';
import { MAINTENANCE_PARKING_STATUSES } from '../config/maintenanceConstants.js';

const maintenanceParkingRecordSchema = new mongoose.Schema(
  {
    unitNumber: { type: String, trim: true, required: true, maxlength: 80 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    timeLabel: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    amount: { type: Number, default: null, min: 0 },
    status: {
      type: String,
      enum: MAINTENANCE_PARKING_STATUSES,
      default: 'Local Weekly',
    },
    note: { type: String, trim: true, default: '', maxlength: 4000 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastEditedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

maintenanceParkingRecordSchema.index({ unitNumber: 1, startDate: -1 });
maintenanceParkingRecordSchema.index({ status: 1, startDate: -1 });
maintenanceParkingRecordSchema.index({ lastEditedAt: -1 });

export const MaintenanceParkingRecord = mongoose.model(
  'MaintenanceParkingRecord',
  maintenanceParkingRecordSchema
);