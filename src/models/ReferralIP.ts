import mongoose from 'mongoose';

const referralIPSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true },
  referralCount: { type: Number, default: 0 },
});

export default mongoose.models.ReferralIP || mongoose.model('ReferralIP', referralIPSchema);
