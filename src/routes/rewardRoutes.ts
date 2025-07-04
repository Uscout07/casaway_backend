// src/routes/rewardRoutes.ts
import { Router } from 'express';
import { getRewardCatalog, redeemReward } from '../controllers/rewardController';

const router = Router();

router.get('/catalog', getRewardCatalog); // GET /api/rewards/catalog
router.post('/redeem', redeemReward);     // POST /api/redeem

export default router;
