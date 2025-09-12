// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";

declare global {
  namespace Express {
    interface User extends IUser {}
    interface Request {
      user?: User;
      userId?: string; // retained for backwards compatibility
    }
  }
}

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

// Auth middleware to verify token, attach userId and full user
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    console.error("[AUTH_MIDDLEWARE] Configuration Error: JWT_SECRET is not set.");
    res.status(500).json({ msg: "Server config error: JWT secret missing." });
    return;
  }

  if (!token) {
    console.warn("[AUTH_MIDDLEWARE] No token found in Authorization header. Access denied.");
    res.status(401).json({ msg: "No token, authorization denied." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.userId = decoded.id;

    // Fetch full user for role checks
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      console.warn(
        `[AUTH_MIDDLEWARE] Token valid but user not found (id=${decoded.id}).`
      );
      res.status(401).json({ msg: "User not found." });
      return;
    }
    req.user = user;

    console.log(`[AUTH_MIDDLEWARE] Token validated for userId: ${req.userId}`);
    next();
  } catch (err: any) {
    console.error("[AUTH_MIDDLEWARE] Token validation failed:", err.message);
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ msg: "Token expired, please log in again." });
    } else {
      res.status(401).json({ msg: "Token is not valid." });
    }
    return;
  }
};

// Admin-only middleware
export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ msg: "Authentication required: no user in request." });
    return;
  }

  if (req.user.role !== "admin") {
    console.warn(
      `[AUTH_MIDDLEWARE] Access denied for userId=${req.user.id}, role=${req.user.role}.`
    );
    res.status(403).json({ msg: "Admins only." });
    return;
  }

  next();
};
