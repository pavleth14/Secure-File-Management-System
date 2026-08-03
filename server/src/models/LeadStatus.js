import mongoose from 'mongoose';

const leadStatusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export const LeadStatus = mongoose.model('LeadStatus', leadStatusSchema);
