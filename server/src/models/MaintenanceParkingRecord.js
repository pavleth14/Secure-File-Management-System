import mongoose from 'mongoose';
import {
  MAINTENANCE_PARKING_STATUSES,
  MAINTENANCE_PARKING_UNIT_SCOPES,
} from '../config/maintenanceConstants.js';

const maintenanceParkingRecordSchema = new mongoose.Schema(
  {
    unitScope: {
      type: String,
      enum: MAINTENANCE_PARKING_UNIT_SCOPES,
      default: 'truck',
    },
    truckNumber: { type: String, trim: true, default: '', maxlength: 80 },
    trailerNumber: { type: String, trim: true, default: '', maxlength: 80 },
    /** Denormalized display + search (truck #, trailer #, or both). */
    unitNumber: { type: String, trim: true, default: '', maxlength: 160 },
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
maintenanceParkingRecordSchema.index({ truckNumber: 1, startDate: -1 });
maintenanceParkingRecordSchema.index({ trailerNumber: 1, startDate: -1 });
maintenanceParkingRecordSchema.index({ status: 1, startDate: -1 });
maintenanceParkingRecordSchema.index({ lastEditedAt: -1 });

export const MaintenanceParkingRecord = mongoose.model(
  'MaintenanceParkingRecord',
  maintenanceParkingRecordSchema
);