// src/routes/referralRoutes.ts
import express, { Request, Response } from 'express';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';
import { authenticateToken } from '../middleware/auth';

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

// POST /api/referral/apply - Apply referral code for existing users (OAuth users)
router.post('/apply', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refCode } = req.body;
  const userId = req.user?.id;

  if (!refCode) {
    res.status(400).json({ msg: 'Referral code is required.' });
    return;
  }

  if (!userId) {
    res.status(401).json({ msg: 'User not authenticated.' });
    return;
  }

  try {
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
      res.status(400).json({ msg: 'You have already used a referral code.' });
      return;
    }

    // Update referred user and referrer
    referredUser.referredBy = refCode;
    referrer.points = (referrer.points || 0) + 10;  // Bonus points for referring
    referredUser.points = (referredUser.points || 0) + 5; // Bonus points for being referred

    await referrer.save();
    await referredUser.save();

    res.status(200).json({ 
      msg: 'Referral applied successfully.',
      referrer: referrer.username,
      pointsEarned: 5
    });
  } catch (err) {
    console.error('Error applying referral:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
}));

// Admin routes for managing invites and referrals
// GET /api/referral/admin/invites - Get all invites
router.get('/admin/invites', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is admin
    const currentUser = await User.findById(req.user?.id);
    if (!currentUser || currentUser.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    // Get all users with referral codes (invites)
    const users = await User.find({ referralCode: { $exists: true } })
      .select('_id username name email referralCode points createdAt')
      .sort({ createdAt: -1 });

    const invites = users.map(user => ({
      id: user._id,
      name: user.name || user.username,
      email: user.email,
      referralCode: user.referralCode,
      points: user.points || 0,
      createdAt: user.createdAt,
      used: false // This would need to be determined by checking if anyone used this referral code
    }));

    res.json({ invites });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
}));

// GET /api/referral/admin/stats - Get referral statistics
router.get('/admin/stats', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is admin
    const currentUser = await User.findById(req.user?.id);
    if (!currentUser || currentUser.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    const totalUsers = await User.countDocuments();
    const totalReferrals = await User.countDocuments({ referredBy: { $exists: true } });
    const totalPoints = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);

    res.json({
      totalUsers,
      totalReferrals,
      totalPoints: totalPoints[0]?.total || 0,
      referralRate: totalUsers > 0 ? (totalReferrals / totalUsers * 100).toFixed(2) : 0
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
}));

// POST /api/referral/admin/generate-invite - Generate admin invite
router.post('/admin/generate-invite', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is admin
    const currentUser = await User.findById(req.user?.id);
    if (!currentUser || currentUser.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    const { name, email } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }

    // Generate a unique referral code
    const referralCode = `ADMIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a temporary user record for the invite
    const inviteUser = new User({
      username: `invite_${referralCode}`,
      name: name,
      email: email || '',
      referralCode: referralCode,
      points: 0,
      role: 'user'
    });

    await inviteUser.save();

    const invitePath = `/auth?ref=${referralCode}`;

    res.json({
      message: 'Invite generated successfully',
      invitePath,
      referralCode
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
}));

// GET /api/referral/admin/referral-analytics - Get detailed referral analytics
router.get('/admin/referral-analytics', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is admin
    const currentUser = await User.findById(req.user?.id);
    if (!currentUser || currentUser.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    // Get top referrers
    const topReferrers = await User.aggregate([
      { $match: { referralCode: { $exists: true } } },
      {
        $lookup: {
          from: 'users',
          localField: 'referralCode',
          foreignField: 'referredBy',
          as: 'referredUsers'
        }
      },
      {
        $project: {
          name: 1,
          username: 1,
          referralCode: 1,
          points: 1,
          referralCount: { $size: '$referredUsers' }
        }
      },
      { $sort: { referralCount: -1 } },
      { $limit: 10 }
    ]);

    // Get recent referrals
    const recentReferrals = await User.find({ referredBy: { $exists: true } })
      .populate('referredBy', 'name username')
      .select('name username referredBy createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      topReferrers,
      recentReferrals
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
}));

export default router;
