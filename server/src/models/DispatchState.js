import mongoose from 'mongoose';

const dispatchStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'load_counter' },
    lastLoadNumber: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const DispatchState = mongoose.model('DispatchState', dispatchStateSchema);
