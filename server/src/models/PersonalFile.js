import mongoose from 'mongoose';

const personalFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    relativePath: { type: String, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    personalFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalFolder',
      default: null,
      index: true,
    },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
  },
  { timestamps: true }
);

personalFileSchema.index({ userId: 1, createdAt: -1 });

export const PersonalFile = mongoose.model('PersonalFile', personalFileSchema);
