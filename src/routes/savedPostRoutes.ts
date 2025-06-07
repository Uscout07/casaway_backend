// src/routes/savedPostRoutes.ts
import express, { Request, Response } from 'express';
import SavedPost from '../models/SavedPost';
import Post from '../models/Post';
import { authenticateToken } from '../middleware/auth';
import asyncHandler from '../utils/asyncHandler'; // Import asyncHandler
import mongoose from 'mongoose'; // Import mongoose for ObjectId validation

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// Toggle Save Post
router.post('/toggle/:postId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return; // Early exit
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ msg: 'Invalid Post ID format.' });
        return;
    }

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404).json({ msg: 'Post not found.' });
        return; // Early exit
    }

    const existingSavedPost = await SavedPost.findOne({ user: userId, post: postId });

    if (existingSavedPost) {
        // Unsave
        await SavedPost.deleteOne({ _id: existingSavedPost._id });
        res.status(200).json({ saved: false, msg: 'Post unsaved successfully.' });
    } else {
        // Save
        await SavedPost.create({ user: userId, post: postId });
        res.status(201).json({ saved: true, msg: 'Post saved successfully.' });
    }
}));

// Get user's saved posts
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return; // Early exit
    }

    const savedPosts = await SavedPost.find({ user: userId }).populate({
        path: 'post',
        populate: {
            path: 'user', // Populate the user within the post
            select: 'username profilePic name'
        }
    }).sort({ createdAt: -1 });

    // The .map(sp => sp.post) requires careful typing if `sp.post` is not directly the `IPost` interface
    // but rather a Mongoose document. If you get TS errors here, you might need to cast or define
    // a more specific type for `savedPosts`. For now, `sp.post` should be correctly populated.
    res.json(savedPosts.map(sp => sp.post)); // Return just the post objects
}));

// Check if a post is saved by the current user
router.get('/status/:postId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return; // Early exit
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ msg: 'Invalid Post ID format.' });
        return;
    }

    const isSaved = await SavedPost.exists({ user: userId, post: postId });
    res.json({ isSaved: !!isSaved }); // !!isSaved converts a truthy/falsy value to true/false boolean
}));

export default router;