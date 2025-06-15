// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      userId?: string; // This is fine, we're just mapping 'id' to 'userId'
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    console.error('[AUTH_MIDDLEWARE] Configuration Error: JWT_SECRET is not set.');
    res.status(500).json({ msg: 'Server configuration error: JWT secret not available.' });
    return;
  }

  if (!token) {
    console.warn('[AUTH_MIDDLEWARE] No token found in Authorization header. Authorization denied.');
    res.status(401).json({ msg: 'No token, authorization denied' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string, iat: number, exp: number };
    req.userId = decoded.id; // Correctly extract 'id' from the decoded token
    console.log(`[AUTH_MIDDLEWARE] Token validated for userId: ${req.userId}`);
    next();
  } catch (err: any) {
    console.error('[AUTH_MIDDLEWARE] Token validation failed:', err.message);
    if (err.name === 'TokenExpiredError') {
        res.status(401).json({ msg: 'Token expired, please log in again.' });
    } else {
        res.status(401).json({ msg: 'Token is not valid' });
    }
    return;
  }
};