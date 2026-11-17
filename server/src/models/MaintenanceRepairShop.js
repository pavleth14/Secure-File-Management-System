import mongoose from 'mongoose';

const maintenanceRepairShopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mapsUrl: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    zip: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

maintenanceRepairShopSchema.index({ name: 1 });
maintenanceRepairShopSchema.index({ isActive: 1, name: 1 });

export const MaintenanceRepairShop = mongoose.model(
  'MaintenanceRepairShop',
  maintenanceRepairShopSchema
);