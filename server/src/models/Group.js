import mongoose from 'mongoose';
import { ALL_PERMISSIONS } from '../config/constants.js';

const permissionSchema = new mongoose.Schema(
  {
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
    allowedActions: [
      {
        type: String,
        enum: ALL_PERMISSIONS,
      },
    ],
    showContents: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    permissions: [permissionSchema],
  },
  { timestamps: true }
);

export const Group = mongoose.model('Group', groupSchema);
