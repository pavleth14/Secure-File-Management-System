import mongoose from 'mongoose';
import { EQUIPMENT_STATUSES } from '../config/dispatchConstants.js';

const truckSchema = new mongoose.Schema(
  {
    truckNumber: { type: String, required: true, unique: true, trim: true },
    type: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: EQUIPMENT_STATUSES,
      default: 'Active',
    },
    make: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    year: { type: String, default: '', trim: true },
    vin: { type: String, default: '', trim: true },
    plateNumber: { type: String, default: '', trim: true },
    dotInspectionExpiration: { type: Date, default: null },
    platesExpiration: { type: Date, default: null },
    notes: { type: String, default: '', trim: true },
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
  },
  { timestamps: true }
);

truckSchema.index({ status: 1, truckNumber: 1 });

export const Truck = mongoose.model('Truck', truckSchema);
