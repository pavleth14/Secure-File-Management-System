import mongoose from 'mongoose';

const dispatchBoardSchema = new mongoose.Schema(
  {
    boardNumber: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    teamLeaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

export const DispatchBoard = mongoose.model('DispatchBoard', dispatchBoardSchema);
