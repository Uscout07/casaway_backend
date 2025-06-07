// src/routes/userRoutes.ts
import express, { Request, Response } from 'express';
import User from '../models/User';
import { authenticateToken } from '../middleware/auth';
import asyncHandler from '../utils/asyncHandler'; // Import asyncHandler
import mongoose from 'mongoose'; // For ObjectId validation

const router = express.Router();

interface AuthenticatedRequest extends Request {
    userId?: string;
}

// Helper for logging errors (optional, but good for consistent logging)
function logError(prefix: string, error: unknown) {
    if (error instanceof Error) {
        console.error(prefix, error.message);
    } else {
        console.error(prefix, String(error));
    }
}

// Updated /me route with debugging
router.get('/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    console.log('=== /users/me endpoint hit ===');
    console.log('Headers:', req.headers);
    console.log('UserId from middleware:', req.userId);

    if (!req.userId) {
        console.error('No userId found in request after auth middleware');
        res.status(401).json({ msg: 'Authentication failed - no user ID' });
        return;
    }

    console.log('Searching for user with ID:', req.userId);
    const user = await User.findById(req.userId).select('-password');
    console.log('User found:', user ? 'Yes' : 'No');

    if (!user) {
        console.error('User not found in database with ID:', req.userId);
        res.status(404).json({ msg: 'User not found' });
        return;
    }

    console.log('Returning user data for:', user.email);
    res.json(user);
}));

// Complete profile setup (NEW ROUTE)
router.post('/complete-profile', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { username, name, phone, city, country, profilePic, instagramUrl, bio } = req.body;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    // Basic validation for required fields for profile completion
    if (!username || !name || !phone || !city || !country) {
        res.status(400).json({ msg: 'Username, name, phone, city, and country are required to complete profile.' });
        return;
    }

    // Check if username is already taken (excluding current user)
    const existingUser = await User.findOne({
        username: username,
        _id: { $ne: userId }
    });

    if (existingUser) {
        res.status(400).json({ msg: 'Username is already taken.' });
        return;
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
            username,
            name,
            phone,
            city,
            country,
            profilePic,
            instagramUrl,
            bio,
            isProfileComplete: true
        },
        { new: true }
    ).select('-password');

    if (!updatedUser) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    res.json({
        msg: 'Profile completed successfully',
        user: updatedUser
    });
}));

// Get user profile by ID
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ msg: 'Invalid user ID format.' });
        return;
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    res.json({
        ...user.toObject(),
        isSelf: user._id.toString() === req.userId, // helpful for frontend UI logic
    });
}));

// Get followers
router.get('/:id/followers', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ msg: 'Invalid user ID format.' });
        return;
    }

    const user = await User.findById(req.params.id).populate('followers', 'name username profilePic');
    if (!user) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }
    res.json(user.followers);
}));

// Get following
router.get('/:id/following', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ msg: 'Invalid user ID format.' });
        return;
    }

    const user = await User.findById(req.params.id).populate('following', 'name username profilePic');
    if (!user) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }
    res.json(user.following);
}));

// Update user profile
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId?.toString();
    const targetUserId = req.params.id;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        res.status(400).json({ msg: 'Invalid user ID format.' });
        return;
    }

    if (userId !== targetUserId) {
        res.status(403).json({ msg: "Unauthorized: Not allowed to edit this user." });
        return;
    }

    const updated = await User.findByIdAndUpdate(targetUserId, req.body, { new: true }).select('-password');
    if (!updated) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }
    res.json(updated);
}));

// Search users by username or name
router.get('/search/users', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
        res.status(400).json({ msg: 'Missing search query.' });
        return;
    }

    const regex = new RegExp(query, 'i');
    const users = await User.find({
        $or: [{ username: regex }, { name: regex }]
    }).select('username name profilePic');

    res.json(users);
}));

// Edit profile route (PATCH for partial updates)
router.patch('/edit', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { name, username, phone, city, country, profilePic, instagramUrl, bio } = req.body; // Added bio back for consistency

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    // Check if username is already taken (excluding current user)
    if (username) {
        const existingUser = await User.findOne({
            username: username,
            _id: { $ne: userId }
        });

        if (existingUser) {
            res.status(400).json({ msg: 'Username is already taken.' });
            return;
        }
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { name, username, phone, city, country, profilePic, instagramUrl, bio }, // Included bio in update fields
        { new: true }
    ).select('-password');

    if (!updatedUser) { // This case should ideally not happen if userId is valid
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    res.status(200).json(updatedUser);
}));


// Get user activity
router.get('/activity', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    // You'll need to import these models (e.g., Post, Comment, Listing if used)
    // import Post from '../models/Post';
    // import Comment from '../models/Comment';
    // import Listing from '../models/Listing';

    // const posts = await Post.find({ user: userId }); // Assuming 'user' field in Post model
    // const comments = await Comment.find({ user: userId }); // Assuming 'user' field in Comment model
    // const likedPosts = await Post.find({ likes: userId }); // Assuming 'likes' is an array of user IDs on Post model
    // const listings = await Listing.find({ user: userId }); // Assuming 'user' field in Listing model

    res.status(200).json({
        // posts,
        // comments,
        // likedPosts,
        // listings,
        message: 'Activity endpoint - Uncomment and import models to fetch actual data.'
    });
}));

// Delete user account
router.delete('/delete', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    // Consider adding a confirmation step or password verification here for security.

    // Delete user
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    // Delete user's associated data (uncomment when models are available and imported)
    // Example:
    // import Post from '../models/Post';
    // import Comment from '../models/Comment';
    // import Listing from '../models/Listing';
    // await Post.deleteMany({ user: userId });
    // await Comment.deleteMany({ user: userId });
    // await Listing.deleteMany({ user: userId });

    res.status(200).json({ message: 'User and associated data deleted successfully.' });
}));

export default router;