import mongoose from 'mongoose';
import { LOAD_STATUSES } from '../config/dispatchConstants.js';

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const stopSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    scheduledAt: { type: Date, required: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const loadAssignmentHistorySchema = new mongoose.Schema(
  {
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
      default: null,
    },
    trailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trailer',
      default: null,
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
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const loadSchema = new mongoose.Schema(
  {
    loadNumber: { type: Number, required: true, unique: true },
    customer: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    customerLoadNumber: { type: String, required: true, trim: true },
    invoiceAmount: { type: Number, required: true },
    pickups: { type: [stopSchema], required: true },
    deliveries: { type: [stopSchema], required: true },
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
      required: true,
    },
    trailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trailer',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    coDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    loadedMiles: { type: Number, required: true },
    emptyMiles: { type: Number, required: true },
    status: {
      type: String,
      enum: LOAD_STATUSES,
      default: 'open',
    },
    isActive: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deliveredAt: { type: Date, default: null },
    assignmentHistory: { type: [loadAssignmentHistorySchema], default: [] },
    comments: [commentSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

loadSchema.index({ archived: 1, createdAt: -1 });
loadSchema.index({ truckId: 1, archived: 1, status: 1 });
loadSchema.index({ trailerId: 1, archived: 1, status: 1 });
loadSchema.index({ driverId: 1, archived: 1, status: 1 });
loadSchema.index({ coDriverId: 1, archived: 1, status: 1 });
loadSchema.index({ isActive: 1, truckId: 1 });

export const Load = mongoose.model('Load', loadSchema);
