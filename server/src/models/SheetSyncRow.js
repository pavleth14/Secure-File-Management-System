import mongoose from 'mongoose';

const sheetSyncRowSchema = new mongoose.Schema(
  {
    metaLeadId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    spreadsheetId: { type: String, trim: true, default: '' },
    sheetName: { type: String, trim: true, default: '' },
    rowNumber: { type: Number, default: null },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    status: {
      type: String,
      enum: ['created', 'skipped_duplicate_contact', 'skipped_already_ingested'],
      required: true,
    },
  },
  { timestamps: { createdAt: 'ingestedAt', updatedAt: false } }
);

sheetSyncRowSchema.index({ sheetName: 1, rowNumber: 1 });

export const SheetSyncRow = mongoose.model('SheetSyncRow', sheetSyncRowSchema);
