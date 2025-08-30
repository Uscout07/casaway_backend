import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { runSpeedTest } from '../controllers/speedTestController';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Main speed test endpoint - uses LibreSpeed API
router.post('/', authenticateToken, asyncHandler(runSpeedTest));

export default router;
