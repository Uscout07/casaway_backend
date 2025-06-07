// src/utils/asyncHandler.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';

// This wrapper handles promises and catches errors, passing them to next()
const asyncHandler = (fn: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;