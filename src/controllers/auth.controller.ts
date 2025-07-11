// src/controllers/authController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export const registerUser = async (req: Request, res: Response) => {
    const { name, username, email, password, inviteToken } = req.body;
    console.log("[AUTH_CONTROLLER] Register attempt for:", { email, username, name, inviteToken });

    if (!username || !email || !password) {
        return res.status(400).json({
            msg: "Please enter all required fields (username, email, password).",
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            msg: "Server configuration error: JWT_SECRET is missing.",
        });
    }

    // Determine role from inviteToken
    let role: 'user' | 'ambassador' = 'user';
    if (inviteToken) {
        try {
            const payload = jwt.verify(inviteToken, process.env.JWT_SECRET!) as any;
            if (payload.role === 'ambassador') {
                role = 'ambassador';
            }
        } catch (err) {
            return res.status(400).json({ msg: "Invalid or expired invite token." });
        }
    }

    try {
        // Check for existing email
        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: "An account with this email already exists." });
        }

        // Check for existing username
        existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ msg: "An account with this username already exists." });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with overridden role
        const user = await User.create({
            name,
            username,
            email,
            password: hashedPassword,
            role,  // ← sets to "ambassador" if inviteToken valid
            referralCode: username.toLowerCase()
        });

        console.log("[AUTH_CONTROLLER] User created in DB:", user.email);

        // Sign JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        // Set HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Send response
        res.status(201).json({
            msg: "User registered successfully",
            token,
            user: {
                _id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        });

        console.log("[AUTH_CONTROLLER] Registration success.");
    } catch (err: any) {
        console.error("[AUTH_CONTROLLER] Register server error:", err);

        // Duplicate key (unique) error handling
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue)[0];
            return res.status(400).json({
                msg: `An account with this ${field} already exists.`,
            });
        }
        // Mongoose validation
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map((val: any) => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }

        // Generic
        res.status(500).json({
            msg: "Server error",
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }
};

export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    console.log('[AUTH_CONTROLLER] Login attempt for:', { email });

    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields (email, password)' });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ msg: 'Server configuration error: JWT_SECRET is missing.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .status(200)
        .json({
            msg: 'Logged in successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role
            },
        });

        console.log('[AUTH_CONTROLLER] Login success.');
    } catch (err) {
        console.error('[AUTH_CONTROLLER] Login server error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
};
