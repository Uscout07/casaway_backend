// src/routes/rewardRoutes.ts
import { Router } from 'express';
import { getRewardCatalog, redeemReward } from '../controllers/rewardController';

const router = Router();

router.get('/catalog', getRewardCatalog);
router.post('/redeem', redeemReward);

export default router;
