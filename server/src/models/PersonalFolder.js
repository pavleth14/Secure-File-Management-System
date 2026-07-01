import mongoose from 'mongoose';

const personalFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalFolder',
      default: null,
    },
    relativePath: { type: String, required: true },
  },
  { timestamps: true }
);

personalFolderSchema.index({ userId: 1, parentFolderId: 1, name: 1 });

export const PersonalFolder = mongoose.model('PersonalFolder', personalFolderSchema);
