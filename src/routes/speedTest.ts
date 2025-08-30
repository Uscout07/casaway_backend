import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { speedTest, runSpeedTest, runFallbackSpeedTest } from '../controllers/speedTestController';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Main speed test endpoint - tries both methods
router.post('/', authenticateToken, asyncHandler(speedTest));

// Direct speed test endpoint (using fast-speedtest-api)
router.post('/fast', authenticateToken, asyncHandler(runSpeedTest));

// Fallback speed test endpoint (using HTTP requests)
router.post('/fallback', authenticateToken, asyncHandler(runFallbackSpeedTest));

export default router;
