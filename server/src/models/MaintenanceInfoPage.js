import mongoose from 'mongoose';
import { MAINTENANCE_INFO_PAGE_SLUGS } from '../config/maintenanceInfoPages.js';

const maintenanceInfoPageSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      enum: MAINTENANCE_INFO_PAGE_SLUGS,
      required: true,
      unique: true,
    },
    content: { type: String, default: '' },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export const MaintenanceInfoPage = mongoose.model(
  'MaintenanceInfoPage',
  maintenanceInfoPageSchema
);
