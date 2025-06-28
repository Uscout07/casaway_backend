import User from '../models/User';
import Redemption from '../models/Redemption';
import { Request, Response, Router } from 'express';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

router.post('/api/redeem', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, rewardName, cost } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.points < cost) {
      res.status(400).json({ message: 'Not enough points' });
      return;
    }

    user.points -= cost;
    await user.save();

    await Redemption.create({
      userId,
      rewardName,
      pointsUsed: cost,
      status: 'pending',
    });

    res.json({ message: 'Redemption request submitted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
}));

export default router;
