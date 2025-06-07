// routes/commentRoutes.ts
import express, { Request, Response } from 'express';
import Comment from "../models/Comment";
import Post from '../models/Post';
import Listing from '../models/Listing';
import { authenticateToken } from '../middleware/auth';
import mongoose from 'mongoose';

const router = express.Router();

interface AuthenticatedRequest extends Request {
    userId?: string;
}

// Add a comment to a Post (Updated to match your frontend expectations)
router.post('/:postId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { postId } = req.params;
        const { content, parentCommentId } = req.body;
        const userId = req.userId;

        if (!userId) return res.status(401).json({ msg: 'User not authenticated' });
        if (!content) return res.status(400).json({ msg: 'Comment content is required' });

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const newComment = await Comment.create({
            user: userId,
            post: postId,
            text: content,
            parentComment: parentCommentId || null,
        });

        const populatedComment = await newComment.populate('user', 'username profilePic name');
        
        // Transform to match your frontend interface
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
            replies: [] // Initialize empty replies array for new comments
        };

        res.status(201).json(transformedComment);
    } catch (err) {
        console.error('Error adding comment to post:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Get comments for a Post using Instagram-style nesting
router.get('/:postId', async (req: Request, res: Response) => {
    try {
        const { postId } = req.params;

        // Validate postId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        // Get all comments for the post
        const allComments = await Comment.find({ post: postId })
            .populate('user', 'username profilePic name')
            .populate('mentionedUsers', 'username')
            .sort({ createdAt: 1 })
            .lean();

        const commentMap = new Map();
        const topLevelComments = [];

        // First pass: populate commentMap and initialize replies array
        allComments.forEach((comment) => {
            comment.replies = [];
            commentMap.set(comment._id.toString(), comment);
        });

        // Second pass: Organize into Instagram-style 2-level hierarchy
        allComments.forEach((comment) => {
            const parentId = comment.parentComment?.toString();

            if (parentId && commentMap.has(parentId)) {
                let actualParent = commentMap.get(parentId);

                // If the direct parent is itself a reply, find its main parent
                if (actualParent && actualParent.parentComment) {
                    const grandparentId = actualParent.parentComment.toString();
                    if (commentMap.has(grandparentId)) {
                        actualParent = commentMap.get(grandparentId);
                    }
                }

                // Add to the main parent's replies
                if (actualParent) {
                    actualParent.replies.push(commentMap.get(comment._id.toString()));
                }
            } else {
                // This is a top-level comment
                topLevelComments.push(commentMap.get(comment._id.toString()));
            }
        });

        // Sort replies by creation date (oldest first)
        topLevelComments.forEach((comment) => {
            if (comment.replies && comment.replies.length > 0) {
                comment.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            }
        });

        // Transform to match your frontend interface
        const transformedComments = topLevelComments.map(comment => ({
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
            replies: comment.replies?.map(reply => ({
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
});

// Add a comment to a Listing (keeping existing functionality)
router.post('/listing/:listingId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { listingId } = req.params;
        const { text, parentCommentId } = req.body;
        const userId = req.userId;

        if (!userId) return res.status(401).json({ msg: 'User not authenticated' });
        if (!text) return res.status(400).json({ msg: 'Comment text is required' });

        // Validate listingId
        if (!mongoose.Types.ObjectId.isValid(listingId)) {
            return res.status(400).json({ msg: 'Invalid listing ID' });
        }

        const listing = await Listing.findById(listingId);
        if (!listing) return res.status(404).json({ msg: 'Listing not found' });

        const newComment = await Comment.create({
            user: userId,
            listing: listingId,
            text,
            parentComment: parentCommentId || null,
        });

        const populatedComment = await newComment.populate('user', 'username profilePic name');
        res.status(201).json(populatedComment);
    } catch (err) {
        console.error('Error adding comment to listing:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Get comments for a Listing (using the existing static method)
router.get('/listing/:listingId', async (req: Request, res: Response) => {
    try {
        const { listingId } = req.params;
        
        // Validate listingId
        if (!mongoose.Types.ObjectId.isValid(listingId)) {
            return res.status(400).json({ msg: 'Invalid listing ID' });
        }

        const comments = await Comment.getInstagramStyleComments(listingId);
        res.json(comments);
    } catch (err) {
        console.error('Error fetching comments for listing:', err);
        res.status(500).json({ msg: 'Failed to fetch comments' });
    }
});

// Toggle Like on a Comment
router.post('/toggle-like/:commentId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { commentId } = req.params;
        const userId = req.userId;

        if (!userId) return res.status(401).json({ msg: 'User not authenticated' });

        // Validate commentId
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({ msg: 'Invalid comment ID' });
        }

        const comment = await Comment.findById(commentId);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        const userIdString = userId.toString();
        const isLiked = comment.likes.some(id => id.toString() === userIdString);

        if (isLiked) {
            comment.likes = comment.likes.filter(id => id.toString() !== userIdString) as mongoose.Types.ObjectId[];
            await comment.save();
            return res.status(200).json({ liked: false, likesCount: comment.likes.length, msg: 'Comment unliked' });
        } else {
            comment.likes.push(new mongoose.Types.ObjectId(userId));
            await comment.save();
            return res.status(200).json({ liked: true, likesCount: comment.likes.length, msg: 'Comment liked' });
        }
    } catch (err) {
        console.error('Error toggling comment like:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Get like count for a comment
router.get('/likes/:commentId', async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        
        // Validate commentId
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({ msg: 'Invalid comment ID' });
        }

        const comment = await Comment.findById(commentId).select('likes');
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        res.json({ count: comment.likes.length });
    } catch (err) {
        console.error('Error fetching comment like count:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});



export default router;