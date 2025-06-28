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

export default router;
