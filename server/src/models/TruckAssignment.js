import mongoose from 'mongoose';
import { ASSIGNMENT_HISTORY_ACTIONS } from '../config/dispatchConstants.js';

const assignmentHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ASSIGNMENT_HISTORY_ACTIONS,
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    coDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    dispatcherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const truckAssignmentSchema = new mongoose.Schema(
  {
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
      required: true,
      unique: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    coDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    dispatcherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    history: { type: [assignmentHistorySchema], default: [] },
  },
  { timestamps: true }
);

truckAssignmentSchema.index({ driverId: 1 });
truckAssignmentSchema.index({ coDriverId: 1 });
truckAssignmentSchema.index({ dispatcherId: 1 });

export const TruckAssignment = mongoose.model('TruckAssignment', truckAssignmentSchema);
