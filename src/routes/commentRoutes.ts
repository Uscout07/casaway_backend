// src/routes/commentRoutes.ts

import express, { Request, Response } from 'express';
import Comment from "../models/Comment";
import Post from '../models/Post';
import Listing from '../models/Listing';
import { authenticateToken } from '../middleware/auth';
import mongoose from 'mongoose';
import { IUser } from '../models/User';
import asyncHandler from '../utils/asyncHandler';
import Notification from '../models/Notifications'; // Import Notification model

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// Define an interface for the user object after specific population
export interface IPopulatedUserForComment {
    _id: mongoose.Types.ObjectId;
    username: string;
    profilePic?: string;
    name?: string;
}

// Add a comment to a Post
router.post('/:postId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId;
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

        // Create notification based on comment type
        if (parentCommentId) {
            const parentComment = await Comment.findById(parentCommentId);
            if (parentComment && parentComment.user.toString() !== userId) {
                await Notification.create({
                    recipient: parentComment.user,
                    type: 'reply',
                    sourceUser: userId,
                    relatedId: newComment._id, // Related to the new comment (the reply)
                    targetType: 'comment', // Target type is the parent comment
                });
            }
        } else {
            if (post.user.toString() !== userId) { // Don't notify if user comments on their own post
                await Notification.create({
                    recipient: post.user,
                    type: 'comment',
                    sourceUser: userId,
                    relatedId: newComment._id, // Related to the new comment
                    targetType: 'post',
                });
            }
        }

        const populatedComment = await newComment.populate<{ user: IPopulatedUserForComment }>('user', 'username profilePic name');

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

        const allComments = await Comment.find({ post: postId })
            .populate<{ user: IPopulatedUserForComment }>('user', 'username profilePic name')
            .populate('mentionedUsers', 'username')
            .sort({ createdAt: 1 })
            .lean();

        interface ICommentWithReplies extends mongoose.Document {
            _id: mongoose.Types.ObjectId;
            user: IPopulatedUserForComment;
            post: mongoose.Types.ObjectId;
            text: string;
            parentComment?: mongoose.Types.ObjectId;
            createdAt: Date;
            replies: ICommentWithReplies[];
        }

        const commentMap = new Map<string, ICommentWithReplies>();
        const topLevelComments: ICommentWithReplies[] = [];

        allComments.forEach((comment: any) => {
            const processedComment: ICommentWithReplies = { ...comment, replies: [] };
            commentMap.set(processedComment._id.toString(), processedComment);
        });

        allComments.forEach((comment: any) => {
            const parentId = comment.parentComment?.toString();
            const currentComment = commentMap.get(comment._id.toString());

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

        topLevelComments.forEach((comment: ICommentWithReplies) => {
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
            postId: postId,
            content: comment.text,
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
    const userId = req.userId;
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

        // Create notification based on comment type for listing
        if (parentCommentId) {
            const parentComment = await Comment.findById(parentCommentId);
            if (parentComment && parentComment.user.toString() !== userId) {
                await Notification.create({
                    recipient: parentComment.user,
                    type: 'reply',
                    sourceUser: userId,
                    relatedId: newComment._id,
                    targetType: 'comment',
                });
            }
        } else {
            if (listing.user.toString() !== userId) { // Don't notify if user comments on their own listing
                await Notification.create({
                    recipient: listing.user,
                    type: 'comment',
                    sourceUser: userId,
                    relatedId: newComment._id,
                    targetType: 'listing',
                });
            }
        }

        const populatedComment = await newComment.populate<{ user: IPopulatedUserForComment }>('user', 'username profilePic name');
        res.status(201).json(populatedComment);
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

        const comments = await Comment.getInstagramStyleComments(listingId);
        res.json(comments);
    } catch (err) {
        console.error('Error fetching comments for listing:', err);
        res.status(500).json({ msg: 'Failed to fetch comments' });
    }
}));

// Toggle Like on a Comment (This endpoint is redundant if likeRoutes.ts already handles it)
// Keeping it for now as per original file, but ideally consolidate like logic.
router.post('/toggle-like/:commentId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId;
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

// Get all comments by a specific user
router.get('/user/:userId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const requestingUserId = req.userId;

    if (!requestingUserId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    // Users can only view their own comments
    if (requestingUserId !== userId) {
        res.status(403).json({ msg: 'Access denied. You can only view your own comments.' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ msg: 'Invalid user ID' });
        return;
    }

    try {
        const comments = await Comment.find({ user: userId })
            .populate('post', 'caption imageUrl user createdAt')
            .populate('listing', 'title images user createdAt')
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

        res.json(comments);
    } catch (error) {
        console.error('Error fetching user comments:', error);
        res.status(500).json({ msg: 'Server error' });
    }
}));

// Delete a specific comment by ID
router.delete('/:commentId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    try {
        const comment = await Comment.findById(commentId);
        if (!comment) {
            res.status(404).json({ msg: 'Comment not found' });
            return;
        }

        // Check if the user owns this comment
        if (comment.user.toString() !== userId) {
            res.status(403).json({ msg: 'Access denied. You can only delete your own comments.' });
            return;
        }

        await Comment.findByIdAndDelete(commentId);
        res.json({ msg: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ msg: 'Server error' });
    }
}));

// Get comments on user's own posts and listings
router.get('/on-user-content/:userId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const requestingUserId = req.userId;

    if (!requestingUserId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }

    // Users can only view comments on their own content
    if (requestingUserId !== userId) {
        res.status(403).json({ msg: 'Access denied. You can only view comments on your own content.' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ msg: 'Invalid user ID' });
        return;
    }

    try {
        // Find all posts and listings by the user
        const userPosts = await Post.find({ user: userId }).select('_id');
        const userListings = await Listing.find({ user: userId }).select('_id');

        const postIds = userPosts.map(post => post._id);
        const listingIds = userListings.map(listing => listing._id);

        // Find comments on user's posts and listings
        const comments = await Comment.find({
            $or: [
                { post: { $in: postIds } },
                { listing: { $in: listingIds } }
            ]
        })
        .populate('user', 'name username profilePic')
        .populate('post', 'caption imageUrl user createdAt')
        .populate('listing', 'title images user createdAt')
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

        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments on user content:', error);
        res.status(500).json({ msg: 'Server error' });
    }
}));

export default router;