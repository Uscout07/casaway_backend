import mongoose from 'mongoose';

const redemptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rewardName: { type: String, required: true },
  pointsUsed: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Redemption || mongoose.model('Redemption', redemptionSchema);
