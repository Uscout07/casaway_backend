// src/routes/referralRoutes.ts
import express, { Request, Response } from 'express';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Now this correctly maps to /api/referral/:userId
router.get('/:userId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const referralCount = await User.countDocuments({ referredBy: user.referralCode });

    res.json({
      referralCode: user.referralCode,
      referralLink: `https://casaway.vercel.app/auth?ref=${user.referralCode}`,
      points: user.points || 0,
      referralCount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
}));

// POST /api/referral/use
router.post('/use', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refCode, userId } = req.body;

  if (!refCode || !userId) {
    res.status(400).json({ msg: 'Referral code and user ID are required.' });
    return;
  }

  const referredUser = await User.findById(userId);
  const referrer = await User.findOne({ referralCode: refCode });

  if (!referrer) {
    res.status(404).json({ msg: 'Invalid referral code.' });
    return;
  }

  if (!referredUser) {
    res.status(404).json({ msg: 'User not found.' });
    return;

  }

  // Prevent self-referral
  if (referrer._id.toString() === referredUser._id.toString()) {
    res.status(400).json({ msg: 'You cannot use your own referral code.' });
    return;
  }

  // Prevent double referral use
  if (referredUser.referredBy) {
    res.status(400).json({ msg: 'Referral already used.' });
    return;
  }

  // Update referred user and referrer
  referredUser.referredBy = refCode;
  referrer.points = (referrer.points || 0) + 10;  // Or however many points
  referredUser.points = (referredUser.points || 0) + 5;

  await referrer.save();
  await referredUser.save();

  res.status(200).json({ msg: 'Referral applied successfully.' });
}));


export default router;
