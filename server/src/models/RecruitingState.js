import mongoose from 'mongoose';

const recruitingStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'round_robin' },
    lastRecruiterIndex: { type: Number, default: -1 },
  },
  { timestamps: true }
);

export const RecruitingState = mongoose.model('RecruitingState', recruitingStateSchema);
