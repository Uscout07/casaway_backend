// routes/protected.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/me', authenticateToken, async (req, res) => {
  res.json({ msg: 'Protected route accessed', userId: req.userId });
});

export default router;
