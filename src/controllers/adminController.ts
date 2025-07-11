// src/controllers/adminController.ts
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

export const generateCustomInviteLink = (req: Request, res: Response): void => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ msg: "Name is required to generate invite link." });
    return;
  }

  const JWT_SECRET = process.env.JWT_SECRET!;
  const token = jwt.sign(
    { name, role: "ambassador" },
    JWT_SECRET,
    { expiresIn: "2d" }
  );

  // Instead of query param, return just the path
  const invitePath = `/invite/ambassador/${encodeURIComponent(name)}?token=${token}`;

  res.json({ invitePath });
};
