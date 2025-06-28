// src/controllers/authController.ts (assuming this is where these functions live)
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User'; // Adjust path as needed for your User model
// import { MongoServerError } from 'mongodb'; // You might need this import for type checking

export const registerUser = async (req: Request, res: Response) => {
    const { name, username, email, password } = req.body;
    console.log("[AUTH_CONTROLLER] Register attempt for:", { email, username, name }); // Log name too

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

    try {
        // --- IMPORTANT: Check for both email and username uniqueness if both are unique in your schema ---
        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: "An account with this email already exists." });
        }

        existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ msg: "An account with this username already exists. Please choose a different one." });
        }
        // --- END IMPORTANT ---


        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name, // Ensure your Mongoose User schema handles 'name' being optional or required based on frontend behavior.
            username,
            email,
            password: hashedPassword,
            referralCode: username.toLowerCase() + Math.floor(1000 + Math.random() * 9000)
        });

        console.log("[AUTH_CONTROLLER] User created in DB:", user.email);

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        // Set token in HTTP-only cookie (if you intend to use cookies for auth)
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // Use secure in production (HTTPS)
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Also send token in the JSON response body for frontend storage (like localStorage)
        res.status(201).json({
            msg: "User registered successfully",
            token, // Send token in body
            user: {
                _id: user._id,
                name: user.name, // Ensure 'name' is included if sent from frontend
                username: user.username,
                email: user.email,
                // Add other user fields you want the frontend to immediately have, e.g., profilePic: user.profilePic
            },
        });

        console.log("[AUTH_CONTROLLER] Registration success.");
    } catch (err: any) { // Type 'any' for 'err' or specific error types like MongoServerError, ValidationError
        console.error("[AUTH_CONTROLLER] Register server error:", err);

        // --- ENHANCED ERROR HANDLING ---
        // Handle Mongoose duplicate key errors (E11000)
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue)[0];
            return res.status(400).json({
                msg: `An account with this ${field} already exists.`,
                error: err.keyValue
            });
        }
        // Handle Mongoose validation errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map((val: any) => val.message);
            return res.status(400).json({
                msg: messages.join(', ') || 'Validation error.',
                errors: err.errors // Send detailed validation errors
            });
        }

        // Generic server error for other unhandled exceptions
        res.status(500).json({
            msg: "Server error",
            // In development, you might send more error details; in production, keep it generic
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }
};

// ... (your loginUser function)
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