import express, { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser } from '../controllers/auth.controller';
import { generateCustomInviteLink } from '../controllers/adminController';
import { authenticateToken, adminOnly } from '../middleware/auth';

const router = express.Router();

// Invite (admin only)
router.post(
  '/invite',
  authenticateToken,
  adminOnly,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      generateCustomInviteLink(req, res);
    } catch (err) {
      next(err);
    }
  }
);

// Register
router.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await registerUser(req, res);
    } catch (err) {
      next(err);
    }
  }
);

// Login
router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await loginUser(req, res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
