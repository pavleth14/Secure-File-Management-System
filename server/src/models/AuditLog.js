import mongoose from 'mongoose';
import { AUDIT_CATEGORIES, AUDIT_ACTIONS } from '../config/auditConstants.js';

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    username: { type: String, default: 'System' },
    userRole: { type: String, default: null },
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(AUDIT_CATEGORIES),
      required: true,
      index: true,
    },
    targetType: { type: String, default: null, index: true },
    targetId: { type: String, default: null },
    targetName: { type: String, default: null },
    details: { type: String, default: null },
    oldValues: { type: mongoose.Schema.Types.Mixed, default: null },
    newValues: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ username: 1 });
auditLogSchema.index({ category: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
