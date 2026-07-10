import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';

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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    creatorRole: {
      type: String,
      enum: Object.values(ROLES),
      default: null,
    },
  },
  { timestamps: true }
);

folderSchema.index({ parentFolderId: 1, name: 1 });

export const Folder = mongoose.model('Folder', folderSchema);
