
import { Router } from 'express';
import { completeProfile, getLocations } from '../controllers/prelaunch.controller';
import { authenticateToken } from '../middleware/auth';


const router = Router();

router.post('/complete-profile', authenticateToken, completeProfile);
router.get('/locations', getLocations);

export default router;
