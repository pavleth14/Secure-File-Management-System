import mongoose from 'mongoose';

const leadSourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isDefault: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export const LeadSource = mongoose.model('LeadSource', leadSourceSchema);
