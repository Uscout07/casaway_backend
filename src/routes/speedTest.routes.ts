import express from 'express';
import { runSpeedTest } from '../controllers/speedTestController';

const router = express.Router();

console.log('[SPEEDTEST ROUTES] Speed test routes module loaded');
console.log('[SPEEDTEST ROUTES] Setting up GET / route');

router.get('/', (req, res, next) => {
  console.log('[SPEEDTEST ROUTES] GET / route hit');
  next();
}, runSpeedTest);

console.log('[SPEEDTEST ROUTES] Routes configured successfully');

export default router;
