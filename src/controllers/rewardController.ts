// src/controllers/rewardController.ts
import { Request, Response } from 'express';
import { fetchCatalog, placeOrder } from '../utils/tangoApi';
import User from '../models/User';

export const getRewardCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[REWARD] Fetching filtered reward catalog...');
    const fullCatalog = await fetchCatalog();

    const allowedKeys = ['B916708', 'B795341']; // Amazon.com and Uber

    const filteredBrands = fullCatalog.brands
      .filter((b: any) => allowedKeys.includes(b.brandKey))
      .map((b: any) => ({
        brandKey: b.brandKey,
        displayName: b.displayName || b.brandKey,
        imageUrls: Object.values(b.imageUrls || {}),
        cost: 50, // $10 = 50 pts
      }));

    res.status(200).json({ brands: filteredBrands });
  } catch (error: any) {
    console.error('[REWARD] Catalog fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch reward catalog.',
      error: error.message ?? 'Unknown error',
    });
  }
};

export const redeemReward = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, brandKey, value } = req.body;

    if (!userId || !brandKey || !value) {
      res.status(400).json({ message: 'Missing required fields.' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    if ((user.points ?? 0) < value) {
      res.status(400).json({ message: 'Not enough points.' });
      return;
    }

    const response = await placeOrder({
      email: user.email,
      brandKey,
      value,
      firstName: user.name?.split(' ')[0] || 'User',
      lastName: user.name?.split(' ')[1] || '',
    });

    user.points -= value;
    await user.save();

    res.status(200).json({
      message: 'Reward redeemed!',
      giftCard: response,
    });
  } catch (error: any) {
    console.error('[REWARD] Redemption error:', error);
    res.status(500).json({
      message: 'Reward redemption failed.',
      error: error.message ?? 'Unknown error',
    });
  }
};
