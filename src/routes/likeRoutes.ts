// routes/likeRoutes.ts
import express, { Request, Response } from 'express';
import Like from '../models/Like';
import { authenticateToken } from '../middleware/auth';
import Post from '../models/Post'; // To check if post exists
import Listing from '../models/Listing'; // To check if listing exists
import Comment from '../models/Comment';
import mongoose from 'mongoose';

const router = express.Router();

// Toggle Like on a Post
router.post('/toggle/post/:postId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId; // From authenticateToken middleware

    if (!userId) return res.status(401).json({ msg: 'User not authenticated' });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });

    const existingLike = await Like.findOne({ user: userId, post: postId });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      return res.status(200).json({ liked: false, msg: 'Post unliked successfully' });
    } else {
      // Like
      await Like.create({ user: userId, post: postId });
      return res.status(201).json({ liked: true, msg: 'Post liked successfully' });
    }
  } catch (err) {
    console.error('Error toggling post like:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Toggle Like on a Listing
router.post('/toggle/listing/:listingId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const userId = req.userId; // From authenticateToken middleware

    if (!userId) return res.status(401).json({ msg: 'User not authenticated' });

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ msg: 'Listing not found' });

    const existingLike = await Like.findOne({ user: userId, listing: listingId });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      return res.status(200).json({ liked: false, msg: 'Listing unliked successfully' });
    } else {
      // Like
      await Like.create({ user: userId, listing: listingId });
      return res.status(201).json({ liked: true, msg: 'Listing liked successfully' });
    }
  } catch (err) {
    console.error('Error toggling listing like:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Toggle Like on a Comment - Using Comment model's likes array (consistent with posts/listings pattern)
router.post('/toggle/comment/:commentId', authenticateToken, async (req: Request, res: Response) => {
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
    const isLiked = comment.likes && comment.likes.some(id => id.toString() === userIdString);

    if (isLiked) {
      // Unlike - remove user from likes array
      comment.likes = comment.likes.filter(id => id.toString() !== userIdString) as mongoose.Types.ObjectId[];
      await comment.save();
      return res.status(200).json({ 
        liked: false, 
        likesCount: comment.likes.length, 
        msg: 'Comment unliked successfully' 
      });
    } else {
      // Like - add user to likes array
      if (!comment.likes) comment.likes = [];
      comment.likes.push(new mongoose.Types.ObjectId(userId));
      await comment.save();
      return res.status(200).json({ 
        liked: true, 
        likesCount: comment.likes.length, 
        msg: 'Comment liked successfully' 
      });
    }
  } catch (err) {
    console.error('Error toggling comment like:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get like status for a specific user on a specific item (optional, useful for UI)
router.get('/status/:itemId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const userId = req.userId;

    if (!userId) return res.status(401).json({ msg: 'User not authenticated' });

    // Check if it's a post or listing by trying to find both
    const isLikedPost = await Like.findOne({ user: userId, post: itemId });
    const isLikedListing = await Like.findOne({ user: userId, listing: itemId });

    if (isLikedPost) {
      return res.json({ isLiked: true, itemType: 'post' });
    } else if (isLikedListing) {
      return res.json({ isLiked: true, itemType: 'listing' });
    } else {
      return res.json({ isLiked: false });
    }
  } catch (err) {
    console.error('Error getting like status:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get total likes for a Post
router.get('/count/post/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const count = await Like.countDocuments({ post: postId });
    res.json({ count });
  } catch (err) {
    console.error('Error fetching post like count:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get total likes for a Listing
router.get('/count/listing/:listingId', async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const count = await Like.countDocuments({ listing: listingId });
    res.json({ count });
  } catch (err) {
    console.error('Error fetching listing like count:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get total likes for a Comment
router.get('/count/comment/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    
    // Validate commentId
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ msg: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId).select('likes');
    if (!comment) return res.status(404).json({ msg: 'Comment not found' });

    const count = comment.likes ? comment.likes.length : 0;
    res.json({ count });
  } catch (err) {
    console.error('Error fetching comment like count:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get comment like status for logged in user
router.get('/status/comment/:commentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    if (!userId) return res.status(401).json({ msg: 'User not authenticated' });

    // Validate commentId
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ msg: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId).select('likes');
    if (!comment) return res.status(404).json({ msg: 'Comment not found' });

    const isLiked = comment.likes && comment.likes.some(id => id.toString() === userId.toString());
    
    return res.json({ isLiked: !!isLiked });
  } catch (err) {
    console.error('Error getting comment like status:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;