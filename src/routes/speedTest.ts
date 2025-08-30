import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { speedTest, runAdvancedSpeedTest } from '../controllers/speedTestController';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Main speed test endpoint - uses advanced continuous monitoring
router.post('/', authenticateToken, asyncHandler(speedTest));

// Advanced speed test endpoint (continuous monitoring)
router.post('/advanced', authenticateToken, asyncHandler(runAdvancedSpeedTest));

export default router;
