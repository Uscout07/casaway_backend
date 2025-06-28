import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User'; // Adjust path as needed for your User model

// NOTE: Do NOT define JWT_SECRET here at the top level using process.env.
// This ensures that process.env.JWT_SECRET is read ONLY when the functions
// are executed, by which time dotenv.config() in index.ts will have run.

export const registerUser = async (req: Request, res: Response) => {
  const { name, username, email, password } = req.body;
  console.log("[AUTH_CONTROLLER] Register attempt for:", { email, username });

  if (!username || !email || !password) {
    return res.status(400).json({
      msg: "Please enter all fields (username, email, password)",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      msg: "Server configuration error: JWT_SECRET is missing.",
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      referralCode: username.toLowerCase() + Math.floor(1000 + Math.random() * 9000)
    });

    console.log("[AUTH_CONTROLLER] User created in DB:", user.email);

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(201)
      .json({
        msg: "User registered successfully",
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
        },
      });

    console.log("[AUTH_CONTROLLER] Registration success.");
  } catch (err) {
    console.error("[AUTH_CONTROLLER] Register server error:", err);
    res.status(500).json({ msg: "Server error", error: err });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  console.log('[AUTH_CONTROLLER] Login attempt for:', { email });

  // Basic validation (optional, but good practice)
  if (!email || !password) {
    console.warn('[AUTH_CONTROLLER] Login failed: Missing fields.');
    return res.status(400).json({ msg: 'Please enter all fields (email, password)' });
  }

  // Runtime check for JWT_SECRET availability
  if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables on the server. Cannot log in user.');
    return res.status(500).json({ msg: 'Server configuration error: JWT_SECRET is missing.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.warn('[AUTH_CONTROLLER] Login failed: User not found.');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // 🧠 Log here inside try block (as you had before, useful for debugging)
    console.log({ enteredPassword: password, storedHash: user.password });

    const isMatch = await bcrypt.compare(password, user.password);
    console.log({ isMatch });

    if (!isMatch) {
      console.warn('[AUTH_CONTROLLER] Login failed: Password mismatch.');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    console.log('[AUTH_CONTROLLER] User logged in successfully:', user.email);

    // Generate JWT using the directly accessed process.env.JWT_SECRET
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('[AUTH_CONTROLLER] JWT generated for logged-in user.');

    // Set token in HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    // Also send the token in the JSON response body for frontend access
    .status(200)
    .json({
      msg: 'Logged in successfully',
      token: token, // <--- Send token in body for frontend to store
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        // Add other user fields you want to send to the frontend, e.g., profilePic: user.profilePic
      },
    });
    console.log('[AUTH_CONTROLLER] Login success response sent with token in body and cookie.');

  } catch (err) {
    console.error('[AUTH_CONTROLLER] Login server error:', err);
    res.status(500).json({ msg: 'Server error', error: err });
  }
};