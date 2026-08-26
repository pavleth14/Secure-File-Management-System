import mongoose from 'mongoose';

const ringCentralWorkerLockSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'call-log-sync-worker' },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false }
);

export const RingCentralWorkerLock = mongoose.model(
  'RingCentralWorkerLock',
  ringCentralWorkerLockSchema
);
