import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    relativePath: { type: String, required: true },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      required: true,
    },
    subfolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
  },
  { timestamps: true }
);

fileSchema.index({ folderId: 1, subfolderId: 1, createdAt: -1 });
fileSchema.index({ uploadedBy: 1, createdAt: -1 });

export const FileModel = mongoose.model('File', fileSchema);
