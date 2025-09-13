// routes/likeRoutes.ts
import express, { Request, Response } from 'express';
import Like from '../models/Like';
import { authenticateToken } from '../middleware/auth';
import Post from '../models/Post'; // To check if post exists
import Listing from '../models/Listing'; // To check if listing exists
import Comment from '../models/Comment';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler';
import Notification from '../models/Notifications'; // Import Notification model
import User from '../models/User'; // Import User model to find owner

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// Helper to safely get error message (recommended to have this in a central utils file)
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error);
}

// Toggle Like on a Post
router.post('/toggle/post/:postId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const userId = req.userId; // From authenticateToken middleware

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404).json({ msg: 'Post not found' });
        return;
    }

    const existingLike = await Like.findOne({ user: userId, post: postId });

    if (existingLike) {
        await Like.deleteOne({ _id: existingLike._id });
        // Optionally remove notification here if needed
        res.status(200).json({ liked: false, msg: 'Post unliked successfully' });
    } else {
        await Like.create({ user: userId, post: postId });

        // Create notification for post owner
        if (post.user.toString() !== userId) { // Don't notify if user likes their own post
            await Notification.create({
                recipient: post.user,
                type: 'like',
                sourceUser: userId,
                relatedId: post._id,
                targetType: 'post',
            });
        }
        res.status(201).json({ liked: true, msg: 'Post liked successfully' });
    }
}));

// Toggle Like on a Listing
router.post('/toggle/listing/:listingId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { listingId } = req.params;
    const userId = req.userId; // From authenticateToken middleware

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
        res.status(404).json({ msg: 'Listing not found' });
        return;
    }

    const existingLike = await Like.findOne({ user: userId, listing: listingId });

    if (existingLike) {
        await Like.deleteOne({ _id: existingLike._id });
        // Optionally remove notification here if needed
        res.status(200).json({ liked: false, msg: 'Listing unliked successfully' });
    } else {
        await Like.create({ user: userId, listing: listingId });

        // Create notification for listing owner
        if (listing.user.toString() !== userId) { // Don't notify if user likes their own listing
            await Notification.create({
                recipient: listing.user,
                type: 'like',
                sourceUser: userId,
                relatedId: listing._id,
                targetType: 'listing',
            });
        }
        res.status(201).json({ liked: true, msg: 'Listing liked successfully' });
    }
}));

// Toggle Like on a Comment
router.post('/toggle/comment/:commentId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { commentId } = req.params;
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    // Validate commentId
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        res.status(400).json({ msg: 'Invalid comment ID' });
        return;
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        res.status(404).json({ msg: 'Comment not found' });
        return;
    }

    const userIdString = userId.toString();
    const isLiked = comment.likes && comment.likes.some(id => id.toString() === userIdString);

    if (isLiked) {
        comment.likes = comment.likes.filter(id => id.toString() !== userIdString) as mongoose.Types.ObjectId[];
        await comment.save();
        res.status(200).json({
            liked: false,
            likesCount: comment.likes.length,
            msg: 'Comment unliked successfully'
        });
    } else {
        if (!comment.likes) comment.likes = [];
        comment.likes.push(new mongoose.Types.ObjectId(userId));
        await comment.save();

        // Create notification for comment owner
        if (comment.user.toString() !== userId) { // Don't notify if user likes their own comment
            await Notification.create({
                recipient: comment.user,
                type: 'like',
                sourceUser: userId,
                relatedId: comment._id,
                targetType: 'comment',
            });
        }
        res.status(200).json({
            liked: true,
            likesCount: comment.likes.length,
            msg: 'Comment liked successfully'
        });
    }
}));

// Get like status for a specific user on a specific item
router.get('/status/:itemId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { itemId } = req.params;
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
        res.status(400).json({ msg: 'Invalid item ID' });
        return;
    }

    const isLikedPost = await Like.findOne({ user: userId, post: itemId });
    const isLikedListing = await Like.findOne({ user: userId, listing: itemId });

    if (isLikedPost) {
        res.json({ isLiked: true, itemType: 'post' });
    } else if (isLikedListing) {
        res.json({ isLiked: true, itemType: 'listing' });
    } else {
        res.json({ isLiked: false });
    }
}));

// Get total likes for a Post
router.get('/count/post/:postId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const count = await Like.countDocuments({ post: postId });
    res.json({ count });
}));

// Get total likes for a Listing
router.get('/count/listing/:listingId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { listingId } = req.params;
    const count = await Like.countDocuments({ listing: listingId });
    res.json({ count });
}));

// Get total likes for a Comment
router.get('/count/comment/:commentId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        res.status(400).json({ msg: 'Invalid comment ID' });
        return;
    }

    const comment = await Comment.findById(commentId).select('likes');
    if (!comment) {
        res.status(404).json({ msg: 'Comment not found' });
        return;
    }

    const count = comment.likes ? comment.likes.length : 0;
    res.json({ count });
}));

// Get comment like status for logged in user
router.get('/status/comment/:commentId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { commentId } = req.params;
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        res.status(400).json({ msg: 'Invalid comment ID' });
        return;
    }

    const comment = await Comment.findById(commentId).select('likes');
    if (!comment) {
        res.status(404).json({ msg: 'Comment not found' });
        return;
    }

    const isLiked = comment.likes && comment.likes.some(id => id.toString() === userId.toString());

    res.json({ isLiked: !!isLiked });
}));

// Get all likes by a specific user
router.get('/user/:userId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const requestingUserId = req.userId;

    if (!requestingUserId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    // Users can only view their own likes
    if (requestingUserId !== userId) {
        res.status(403).json({ msg: 'Access denied. You can only view your own likes.' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ msg: 'Invalid user ID' });
        return;
    }

    try {
        const likes = await Like.find({ user: userId })
            .populate('post', 'caption imageUrl user createdAt')
            .populate('listing', 'title images user createdAt')
            .populate('comment', 'text createdAt')
            .populate({
                path: 'post',
                populate: {
                    path: 'user',
                    select: 'name username profilePic'
                }
            })
            .populate({
                path: 'listing',
                populate: {
                    path: 'user',
                    select: 'name username profilePic'
                }
            })
            .sort({ createdAt: -1 });

        res.json(likes);
    } catch (error) {
        console.error('Error fetching user likes:', error);
        res.status(500).json({ msg: 'Server error' });
    }
}));

// Delete a specific like by ID
router.delete('/:likeId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { likeId } = req.params;
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(likeId)) {
        res.status(400).json({ msg: 'Invalid like ID' });
        return;
    }

    try {
        const like = await Like.findById(likeId);
        if (!like) {
            res.status(404).json({ msg: 'Like not found' });
            return;
        }

        // Check if the user owns this like
        if (like.user.toString() !== userId) {
            res.status(403).json({ msg: 'Access denied. You can only delete your own likes.' });
            return;
        }

        await Like.findByIdAndDelete(likeId);
        res.json({ msg: 'Like removed successfully' });
    } catch (error) {
        console.error('Error deleting like:', error);
        res.status(500).json({ msg: 'Server error' });
    }
}));

export default router;