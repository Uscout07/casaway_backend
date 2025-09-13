import { Request, Response, Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import User, { IUser } from '../models/User'; // Import IUser
import mongoose from 'mongoose'; // Import mongoose for Types.ObjectId
import asyncHandler from '../utils/asyncHandler'; // Assuming you have this

const router = Router();

// Helper to safely get error message
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    // For cases where 'error' might be an object with a 'message' property but not an Error instance
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message: unknown }).message); // Safely convert to string
    }
    return String(error); // Fallback for other types
}


// Follow a user
router.post('/follow/:userId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = req.userId; // This should come from your global Express.Request declaration
    const targetUserId = req.params.userId;

    console.log('[Follow Request] Current User ID:', currentUserId, 'Target User ID:', targetUserId);

    if (!currentUserId) {
        console.log('[Follow Error] No current user ID');
        res.status(401).json({ msg: 'Unauthorized' });
        return;
    }

    if (currentUserId === targetUserId) {
        console.log('[Follow Error] User trying to follow themselves');
        res.status(400).json({ msg: "You can't follow yourself" });
        return;
    }

    try {
        console.log('[Follow] Finding users...');
        // Assert that the found user is an IUser document or null
        const currentUser = await User.findById(currentUserId) as (IUser & mongoose.Document) | null;
        const targetUser = await User.findById(targetUserId) as (IUser & mongoose.Document) | null;

        if (!currentUser) {
            console.log('[Follow Error] Current user not found:', currentUserId);
            res.status(404).json({ msg: 'Current user not found' });
            return;
        }

        if (!targetUser) {
            console.log('[Follow Error] Target user not found:', targetUserId);
            res.status(404).json({ msg: 'Target user not found' });
            return;
        }

        console.log('[Follow] Users found. Current user following:', currentUser.following.length, 'Target user followers:', targetUser.followers.length);

        // Now, currentUser._id and targetUser._id are correctly typed as mongoose.Types.ObjectId
        const targetIdStr = targetUser._id.toString();

        // Check if already following
        const isAlreadyFollowing = currentUser.following.some(id => id.toString() === targetIdStr);
        if (isAlreadyFollowing) {
            console.log('[Follow Error] Already following this user');
            res.status(400).json({ msg: 'Already following this user' });
            return;
        }

        console.log('[Follow] Adding to following/followers lists...');
        currentUser.following.push(targetUser._id); // Now targetUser._id is correctly typed
        targetUser.followers.push(currentUser._id); // Now currentUser._id is correctly typed

        await currentUser.save();
        await targetUser.save();

        console.log('[Follow Success] User followed successfully. New followers count:', targetUser.followers.length);

        res.json({
            msg: 'Followed successfully',
            isFollowing: true,
            followersCount: targetUser.followers.length,
            followingCount: currentUser.following.length
        });
    } catch (err) {
        console.error('[POST /follow error]', err);
        res.status(500).json({ msg: 'Server error', error: getErrorMessage(err) });
    }
}));

// Unfollow a user (apply similar type assertions and error handling)
router.post('/unfollow/:userId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = req.userId;
    const targetUserId = req.params.userId;

    console.log('[Unfollow Request] Current User ID:', currentUserId, 'Target User ID:', targetUserId);

    if (!currentUserId) {
        console.log('[Unfollow Error] No current user ID');
        res.status(401).json({ msg: 'Unauthorized' });
        return;
    }

    if (currentUserId === targetUserId) {
        console.log('[Unfollow Error] User trying to unfollow themselves');
        res.status(400).json({ msg: "You can't unfollow yourself" });
        return;
    }

    try {
        const currentUser = await User.findById(currentUserId) as (IUser & mongoose.Document) | null;
        const targetUser = await User.findById(targetUserId) as (IUser & mongoose.Document) | null;

        if (!currentUser) {
            console.log('[Unfollow Error] Current user not found:', currentUserId);
            res.status(404).json({ msg: 'Current user not found' });
            return;
        }

        if (!targetUser) {
            console.log('[Unfollow Error] Target user not found:', targetUserId);
            res.status(404).json({ msg: 'Target user not found' });
            return;
        }

        console.log('[Unfollow] Users found. Current user following:', currentUser.following.length, 'Target user followers:', targetUser.followers.length);

        const targetIdStr = targetUser._id.toString();
        const currentIdStr = currentUser._id.toString();

        // Check if not following
        const isFollowing = currentUser.following.some(id => id.toString() === targetIdStr);
        if (!isFollowing) {
            console.log('[Unfollow Error] Not following this user');
            res.status(400).json({ msg: 'Not following this user' });
            return;
        }

        console.log('[Unfollow] Removing from following/followers lists...');
        currentUser.following = currentUser.following.filter(id => id.toString() !== targetIdStr);
        targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentIdStr);

        await currentUser.save();
        await targetUser.save();

        console.log('[Unfollow Success] User unfollowed successfully. New followers count:', targetUser.followers.length);

        res.json({
            msg: 'Unfollowed successfully',
            isFollowing: false,
            followersCount: targetUser.followers.length,
            followingCount: currentUser.following.length
        });
    } catch (err) {
        console.error('[POST /unfollow error]', err);
        res.status(500).json({ msg: 'Server error', error: getErrorMessage(err) });
    }
}));

// Check if current user is following a specific user (apply similar type assertions and error handling)
router.get('/status/:userId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = req.userId;
    const targetUserId = req.params.userId;

    if (!currentUserId) {
        res.status(401).json({ msg: 'Unauthorized' });
        return;
    }

    try {
        const currentUser = await User.findById(currentUserId) as (IUser & mongoose.Document) | null;
        const targetUser = await User.findById(targetUserId) as (IUser & mongoose.Document) | null;
        
        if (!currentUser) {
            res.status(404).json({ msg: 'Current user not found' });
            return;
        }

        if (!targetUser) {
            res.status(404).json({ msg: 'Target user not found' });
            return;
        }

        const isFollowing = currentUser.following.map(id => id.toString()).includes(targetUserId);
        
        res.json({
            isFollowing,
            followersCount: targetUser.followers.length,
            followingCount: targetUser.following.length
        });
    } catch (err) {
        console.error('[GET /status error]', err);
        res.status(500).json({ msg: 'Server error', error: getErrorMessage(err) });
    }
}));

// Remove a follower (for profile owners)
router.post('/remove-follower/:userId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = req.userId;
    const followerUserId = req.params.userId;

    if (!currentUserId) {
        res.status(401).json({ msg: 'Unauthorized' });
        return;
    }

    if (currentUserId === followerUserId) {
        res.status(400).json({ msg: "You can't remove yourself" });
        return;
    }

    try {
        const currentUser = await User.findById(currentUserId) as (IUser & mongoose.Document) | null;
        const followerUser = await User.findById(followerUserId) as (IUser & mongoose.Document) | null;

        if (!currentUser) {
            res.status(404).json({ msg: 'Current user not found' });
            return;
        }

        if (!followerUser) {
            res.status(404).json({ msg: 'Follower user not found' });
            return;
        }

        // Remove follower from current user's followers list
        currentUser.followers = currentUser.followers.filter(id => id.toString() !== followerUserId);
        
        // Remove current user from follower's following list
        followerUser.following = followerUser.following.filter(id => id.toString() !== currentUserId);

        await currentUser.save();
        await followerUser.save();

        res.json({
            msg: 'Follower removed successfully',
            followersCount: currentUser.followers.length
        });
    } catch (err) {
        console.error('[POST /remove-follower error]', err);
        res.status(500).json({ msg: 'Server error', error: getErrorMessage(err) });
    }
}));

export default router;