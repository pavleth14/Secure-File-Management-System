import mongoose from 'mongoose';

const ringCentralCallSyncSchema = new mongoose.Schema(
  {
    ringCentralEventId: { type: String, required: true, unique: true, trim: true },
    telephonySessionId: { type: String, required: true, trim: true },
    extensionId: { type: String, trim: true, default: null },
    direction: { type: String, enum: ['Inbound', 'Outbound'], required: true },
    externalPhone: { type: String, required: true, trim: true },
    fallbackResult: { type: String, trim: true, default: '' },
    occurredAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, required: true },
    syncedAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

ringCentralCallSyncSchema.index({ syncedAt: 1, nextAttemptAt: 1 });

export const RingCentralCallSync = mongoose.model(
  'RingCentralCallSync',
  ringCentralCallSyncSchema
);
