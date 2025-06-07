// src/routes/commentRoutes.ts

import express, { Request, Response } from 'express';
import Comment from "../models/Comment";
import Post from '../models/Post';
import Listing from '../models/Listing';
import { authenticateToken } from '../middleware/auth';
import mongoose from 'mongoose';
import { IUser } from '../models/User'; // Still need IUser for other contexts if used
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Define an interface for the user object after specific population
export interface IPopulatedUserForComment {
    _id: mongoose.Types.ObjectId;
    username: string;
    profilePic?: string;
    name?: string;
}

// Also, let's refine the type of the 'user' field in Comment to be more specific after population
// You might need to adjust your Comment model's interface if it's currently just `user: ObjectId`
// For now, we'll cast directly in the route, but a more robust solution might involve extending the Comment document.


// Add a comment to a Post
router.post('/:postId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId; // Or just req.userId if your global declaration works
    try {
        const { postId } = req.params;
        const { content, parentCommentId } = req.body;

        if (!userId) {
            res.status(401).json({ msg: 'User not authenticated' });
            return;
        }
        if (!content) {
            res.status(400).json({ msg: 'Comment content is required' });
            return;
        }

        const post = await Post.findById(postId);
        if (!post) {
            res.status(404).json({ msg: 'Post not found' });
            return;
        }

        const newComment = await Comment.create({
            user: userId,
            post: postId,
            text: content,
            parentComment: parentCommentId || null,
        });

        // The key change here: Cast to IPopulatedUserForComment
        const populatedComment = await newComment.populate<{ user: IPopulatedUserForComment }>('user', 'username profilePic name');
        
        // Now, TypeScript knows the structure of populatedComment.user
        const transformedComment = {
            _id: populatedComment._id,
            user: {
                _id: populatedComment.user._id,
                username: populatedComment.user.username,
                profilePic: populatedComment.user.profilePic,
                name: populatedComment.user.name
            },
            postId: postId,
            content: populatedComment.text,
            parentCommentId: populatedComment.parentComment,
            createdAt: populatedComment.createdAt,
            replies: []
        };

        res.status(201).json(transformedComment);
    } catch (err) {
        console.error('Error adding comment to post:', err);
        res.status(500).json({ msg: 'Server error' });
    }
}));

// Get comments for a Post using Instagram-style nesting
router.get('/:postId', asyncHandler(async (req: Request, res: Response) => {
    try {
        const { postId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ msg: 'Invalid post ID' });
            return;
        }

        // Use a type argument for populate to inform TypeScript
        const allComments = await Comment.find({ post: postId })
            .populate<{ user: IPopulatedUserForComment }>('user', 'username profilePic name')
            .populate('mentionedUsers', 'username') // Assuming mentionedUsers are also populated with selected fields
            .sort({ createdAt: 1 })
            .lean();

        // Let's refine the type for comments in the map and arrays
        interface ICommentWithReplies extends Document { // You might need to extend your base IComment if it exists
            _id: mongoose.Types.ObjectId;
            user: IPopulatedUserForComment;
            post: mongoose.Types.ObjectId;
            text: string;
            parentComment?: mongoose.Types.ObjectId;
            createdAt: Date;
            replies: ICommentWithReplies[]; // Recursive type
            // Add other fields you fetch if needed
        }

        const commentMap = new Map<string, ICommentWithReplies>();
        const topLevelComments: ICommentWithReplies[] = [];

        allComments.forEach((comment: any) => { // 'any' for now, better to cast allComments elements directly from populate
            // Cast to ICommentWithReplies to safely add replies
            const processedComment: ICommentWithReplies = { ...comment, replies: [] };
            commentMap.set(processedComment._id.toString(), processedComment);
        });

        allComments.forEach((comment: any) => { // 'any' for now
            const parentId = comment.parentComment?.toString();
            const currentComment = commentMap.get(comment._id.toString()); // Get the already-typed comment from map

            if (parentId && commentMap.has(parentId)) {
                let actualParent = commentMap.get(parentId);

                if (actualParent && actualParent.parentComment) {
                    const grandparentId = actualParent.parentComment.toString();
                    if (commentMap.has(grandparentId)) {
                        actualParent = commentMap.get(grandparentId);
                    }
                }

                if (actualParent && currentComment) {
                    actualParent.replies.push(currentComment);
                }
            } else {
                if (currentComment) {
                    topLevelComments.push(currentComment);
                }
            }
        });

        topLevelComments.forEach((comment: ICommentWithReplies) => { // Typed comment
            if (comment.replies && comment.replies.length > 0) {
                comment.replies.sort((a: ICommentWithReplies, b: ICommentWithReplies) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            }
        });

        const transformedComments = topLevelComments.map((comment: ICommentWithReplies) => ({
            _id: comment._id,
            user: {
                _id: comment.user._id,
                username: comment.user.username,
                profilePic: comment.user.profilePic,
                name: comment.user.name
            },
            postId: postId, // Assuming 'post' field from Comment model
            content: comment.text, // Assuming 'text' field from Comment model
            parentCommentId: comment.parentComment,
            createdAt: comment.createdAt,
            replies: comment.replies?.map((reply: ICommentWithReplies) => ({
                _id: reply._id,
                user: {
                    _id: reply.user._id,
                    username: reply.user.username,
                    profilePic: reply.user.profilePic,
                    name: reply.user.name
                },
                postId: postId,
                content: reply.text,
                parentCommentId: reply.parentComment,
                createdAt: reply.createdAt
            })) || []
        }));

        res.json({ comments: transformedComments });
    } catch (err) {
        console.error('Error fetching comments for post:', err);
        res.status(500).json({ msg: 'Failed to fetch comments' });
    }
}));

// Add a comment to a Listing (keeping existing functionality)
router.post('/listing/:listingId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
        const { listingId } = req.params;
        const { text, parentCommentId } = req.body;

        if (!userId) {
            res.status(401).json({ msg: 'User not authenticated' });
            return;
        }
        if (!text) {
            res.status(400).json({ msg: 'Comment text is required' });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(listingId)) {
            res.status(400).json({ msg: 'Invalid listing ID' });
            return;
        }

        const listing = await Listing.findById(listingId);
        if (!listing) {
            res.status(404).json({ msg: 'Listing not found' });
            return;
        }

        const newComment = await Comment.create({
            user: userId,
            listing: listingId,
            text,
            parentComment: parentCommentId || null,
        });

        // The key change here: Cast to IPopulatedUserForComment
        const populatedComment = await newComment.populate<{ user: IPopulatedUserForComment }>('user', 'username profilePic name');
        res.status(201).json(populatedComment); // populatedComment.user will now be of type IPopulatedUserForComment
    } catch (err) {
        console.error('Error adding comment to listing:', err);
        res.status(500).json({ msg: 'Server error' });
    }
}));

// Get comments for a Listing (using the existing static method)
router.get('/listing/:listingId', asyncHandler(async (req: Request, res: Response) => {
    try {
        const { listingId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(listingId)) {
            res.status(400).json({ msg: 'Invalid listing ID' });
            return;
        }

        // Assuming Comment.getInstagramStyleComments returns a structure that matches your needs
        // If it also populates user, you might need to adjust its return type.
        const comments = await Comment.getInstagramStyleComments(listingId);
        res.json(comments);
    } catch (err) {
        console.error('Error fetching comments for listing:', err);
        res.status(500).json({ msg: 'Failed to fetch comments' });
    }
}));

// Toggle Like on a Comment
router.post('/toggle-like/:commentId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
        const { commentId } = req.params;

        if (!userId) {
            res.status(401).json({ msg: 'User not authenticated' });
            return;
        }

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
        const isLiked = comment.likes.some(id => id.toString() === userIdString);

        if (isLiked) {
            comment.likes = comment.likes.filter(id => id.toString() !== userIdString) as mongoose.Types.ObjectId[];
            await comment.save();
            res.status(200).json({ liked: false, likesCount: comment.likes.length, msg: 'Comment unliked' });
            return;
        } else {
            comment.likes.push(new mongoose.Types.ObjectId(userId));
            await comment.save();
            res.status(200).json({ liked: true, likesCount: comment.likes.length, msg: 'Comment liked' });
            return;
        }
    } catch (err) {
        console.error('Error toggling comment like:', err);
        res.status(500).json({ msg: 'Server error' });
    }
}));

// Get like count for a comment
router.get('/likes/:commentId', asyncHandler(async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({ msg: 'Invalid comment ID' });
            return;
        }

        const comment = await Comment.findById(commentId).select('likes');
        if (!comment) {
            res.status(404).json({ msg: 'Comment not found.' });
            return;
        }

        res.json({ count: comment.likes.length });
    } catch (err) {
        console.error('Error fetching comment like count:', err);
        res.status(500).json({ msg: 'Server error' });
    }
}));


export default router;