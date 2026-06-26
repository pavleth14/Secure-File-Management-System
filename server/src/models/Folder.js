import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    relativePath: { type: String, required: true },
    parentFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    isRoot: { type: Boolean, default: false },
  },
  { timestamps: true }
);

folderSchema.index({ parentFolderId: 1, name: 1 });

export const Folder = mongoose.model('Folder', folderSchema);
