import mongoose from 'mongoose';
import { FILE_SOURCE_TYPES } from '../config/constants.js';

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileType: {
      type: String,
      enum: Object.values(FILE_SOURCE_TYPES),
      required: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true }
);

favoriteSchema.index({ userId: 1, fileType: 1, fileId: 1 }, { unique: true });

export const Favorite = mongoose.model('Favorite', favoriteSchema);
