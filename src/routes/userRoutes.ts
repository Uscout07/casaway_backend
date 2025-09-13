// src/routes/userRoutes.ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import User from '../models/User';
import { authenticateToken } from '../middleware/auth';
import asyncHandler from '../utils/asyncHandler'; // Import asyncHandler
import mongoose from 'mongoose'; // For ObjectId validation
import Listing from '../models/Listing';
import Post from '../models/Post';
import { uploadToS3 } from '../utils/s3';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

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

// Get all users (for group chat member selection)
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    console.log('=== /users endpoint hit ===');
    console.log('Headers:', req.headers);
    console.log('UserId from middleware:', req.userId);

    if (!req.userId) {
        console.error('No userId found in request after auth middleware');
        res.status(401).json({ msg: 'Authentication failed - no user ID' });
        return;
    }

    try {
        // Fetch all users except the current user
        const users = await User.find({ _id: { $ne: req.userId } })
            .select('name email profilePic username city country')
            .limit(100); // Limit to prevent performance issues

        console.log(`Found ${users.length} users`);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ msg: 'Failed to fetch users' });
    }
}));

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
router.post('/complete-profile', authenticateToken, upload.single('profilePic'), asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { username, name, phone, city, country, instagramUrl, bio } = req.body;

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

    let profilePicUrl = req.body.profilePic;
    if (req.file) {
        profilePicUrl = await uploadToS3(req.file);
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
            username,
            name,
            phone,
            city,
            country,
            profilePic: profilePicUrl,
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
router.put('/:id', authenticateToken, upload.single('profilePic'), asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const updates = req.body;
    if (req.file) {
        updates.profilePic = await uploadToS3(req.file);
    }

    const updated = await User.findByIdAndUpdate(targetUserId, updates, { new: true }).select('-password');
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
router.patch('/edit', authenticateToken, upload.single('profilePic'), asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { name, username, phone, city, country, instagramUrl, bio } = req.body;

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

    const updates: any = { name, username, phone, city, country, instagramUrl, bio };
    if (req.file) {
        updates.profilePic = await uploadToS3(req.file);
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        updates,
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

// Change username (no verification required)
router.patch('/change-username', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { newUsername } = req.body;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    if (!newUsername || newUsername.trim().length < 3) {
        res.status(400).json({ msg: 'Username must be at least 3 characters long.' });
        return;
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ username: newUsername.trim() });
    if (existingUser && existingUser._id.toString() !== userId) {
        res.status(400).json({ msg: 'Username is already taken.' });
        return;
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { username: newUsername.trim() },
        { new: true }
    ).select('-password');

    if (!updatedUser) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    res.status(200).json({
        msg: 'Username updated successfully',
        user: updatedUser
    });
}));

// Request password change (sends verification code via email)
router.post('/request-password-change', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    // Check if user has a password (not OAuth user)
    if (!user.password) {
        res.status(400).json({ msg: 'Password change not available for OAuth users.' });
        return;
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store the code in the user document
    user.passwordResetToken = verificationCode;
    user.passwordResetExpires = codeExpiry;
    await user.save();

    // Import email service
    const emailService = require('../utils/emailService').emailService;

    try {
        // Send password reset email with code
        const emailSent = await emailService.sendPasswordResetCode(
            user.email,
            user.username || user.name || 'User',
            verificationCode
        );

        if (emailSent) {
            res.status(200).json({
                msg: 'Verification code sent to your email. Please check your inbox.',
                emailSent: true
            });
        } else {
            // If email fails, still allow the process but inform the user
            res.status(200).json({
                msg: 'Verification code generated. Email delivery failed, but you can use the code below for testing.',
                code: verificationCode, // Only for development/testing
                emailSent: false
            });
        }
    } catch (error) {
        console.error('Error in password reset process:', error);
        res.status(500).json({
            msg: 'Failed to process password reset request. Please try again.',
            emailSent: false
        });
    }
}));

// Change password with current password verification
router.patch('/change-password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    if (!currentPassword || !newPassword) {
        res.status(400).json({ msg: 'Current password and new password are required.' });
        return;
    }

    if (newPassword.length < 6) {
        res.status(400).json({ msg: 'Password must be at least 6 characters long.' });
        return;
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    // Check if user has a password (not OAuth user)
    if (!user.password) {
        res.status(400).json({ msg: 'Password change not available for OAuth users.' });
        return;
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        res.status(400).json({ msg: 'Current password is incorrect.' });
        return;
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
        msg: 'Password changed successfully'
    });
}));

// Change password with verification code (for password reset flow)
router.patch('/reset-password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { verificationCode, newPassword } = req.body;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    if (!verificationCode || !newPassword) {
        res.status(400).json({ msg: 'Verification code and new password are required.' });
        return;
    }

    if (newPassword.length < 6) {
        res.status(400).json({ msg: 'Password must be at least 6 characters long.' });
        return;
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    // Verify the code
    if (user.passwordResetToken !== verificationCode) {
        res.status(400).json({ msg: 'Invalid verification code.' });
        return;
    }

    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
        res.status(400).json({ msg: 'Verification code has expired. Please request a new one.' });
        return;
    }

    // Hash the new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset code
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
        msg: 'Password changed successfully'
    });
}));

// Delete user account
router.delete('/delete', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    // A crucial security step: Consider adding a password verification check here before deletion.
    // For example, you could require the user to send their password in the request body.

    // 1. Delete the user
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
        res.status(404).json({ msg: 'User not found.' });
        return;
    }

    // 2. Delete the user's associated data to maintain data integrity.
    // Make sure to import these models at the top of your file.
    // import Post from '../models/Post';
    // import Comment from '../models/Comment';
    // import Listing from '../models/Listing';

    await Listing.deleteMany({ user: userId }); // Assuming 'user' is the field linking a listing to a user
    await Post.deleteMany({ user: userId });     // Assuming 'user' is the field linking a post to a user
    // Add other models as needed, e.g., comments, messages, etc.

    // 3. Send a success response.
    res.status(200).json({ message: 'User and associated data deleted successfully.' });
}));

// Register push token for notifications
router.post('/register-push-token', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    console.log('=== /register-push-token endpoint hit ===');
    console.log('UserId from middleware:', req.userId);
    console.log('Request body:', req.body);

    if (!req.userId) {
        console.error('No userId found in request after auth middleware');
        res.status(401).json({ msg: 'Authentication failed - no user ID' });
        return;
    }

    const { pushToken, platform } = req.body;

    if (!pushToken) {
        res.status(400).json({ msg: 'Push token is required' });
        return;
    }

    try {
        const user = await User.findById(req.userId);
        if (!user) {
            res.status(404).json({ msg: 'User not found' });
            return;
        }

        // Update user with push token and platform
        user.pushToken = pushToken;
        user.platform = platform || 'unknown';
        await user.save();

        console.log(`Push token registered for user ${req.userId}`);
        res.status(200).json({ 
            msg: 'Push token registered successfully',
            pushToken: pushToken,
            platform: platform 
        });
    } catch (error) {
        logError('Error registering push token:', error);
        res.status(500).json({ msg: 'Server error while registering push token' });
    }
}));

// Get notification settings
router.get('/notification-settings', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    console.log('=== /notification-settings GET endpoint hit ===');
    
    if (!req.userId) {
        res.status(401).json({ msg: 'Authentication failed - no user ID' });
        return;
    }

    try {
        const user = await User.findById(req.userId);
        if (!user) {
            res.status(404).json({ msg: 'User not found' });
            return;
        }

        // Return notification settings (default values if not set)
        const settings = {
            pushNotifications: user.pushNotifications ?? true,
            emailNotifications: user.emailNotifications ?? true,
            smsNotifications: user.smsNotifications ?? false,
            newMessages: user.newMessages ?? true,
            newFollowers: user.newFollowers ?? false,
            appUpdates: user.appUpdates ?? true,
            weeklyDigest: user.weeklyDigest ?? false,
            securityAlerts: user.securityAlerts ?? true,
        };

        res.status(200).json(settings);
    } catch (error) {
        logError('Error fetching notification settings:', error);
        res.status(500).json({ msg: 'Server error while fetching notification settings' });
    }
}));

// Update notification settings
router.patch('/notification-settings', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    console.log('=== /notification-settings PATCH endpoint hit ===');
    console.log('Request body:', req.body);
    
    if (!req.userId) {
        res.status(401).json({ msg: 'Authentication failed - no user ID' });
        return;
    }

    try {
        const user = await User.findById(req.userId);
        if (!user) {
            res.status(404).json({ msg: 'User not found' });
            return;
        }

        // Update notification settings
        const allowedSettings = [
            'pushNotifications', 'emailNotifications', 'smsNotifications',
            'newMessages', 'newFollowers', 'appUpdates', 'weeklyDigest', 'securityAlerts'
        ];

        for (const setting of allowedSettings) {
            if (req.body[setting] !== undefined) {
                (user as any)[setting] = req.body[setting];
            }
        }

        await user.save();

        console.log(`Notification settings updated for user ${req.userId}`);
        res.status(200).json({ 
            msg: 'Notification settings updated successfully',
            settings: req.body
        });
    } catch (error) {
        logError('Error updating notification settings:', error);
        res.status(500).json({ msg: 'Server error while updating notification settings' });
    }
}));

export default router;