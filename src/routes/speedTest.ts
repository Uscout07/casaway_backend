import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { speedTest, runAdvancedSpeedTest, runFallbackSpeedTest, runCloudflareSpeedTest } from '../controllers/speedTestController';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Main speed test endpoint - uses Cloudflare Speedtest API
router.post('/', authenticateToken, asyncHandler(speedTest));

// Cloudflare Speedtest API endpoint
router.post('/cloudflare', authenticateToken, asyncHandler(runCloudflareSpeedTest));

// Advanced speed test endpoint (continuous monitoring)
router.post('/advanced', authenticateToken, asyncHandler(runAdvancedSpeedTest));

// Fallback speed test endpoint (simple HTTP method)
router.post('/fallback', authenticateToken, asyncHandler(runFallbackSpeedTest));

export default router;
