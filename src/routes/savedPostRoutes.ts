// routes/savedPostRoutes.ts
import express, { Request, Response } from 'express';
import SavedPost from '../models/SavedPost';
import Post from '../models/Post';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Toggle Save Post
router.post('/toggle/:postId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    if (!userId) return res.status(401).json({ msg: 'User not authenticated' });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });

    const existingSavedPost = await SavedPost.findOne({ user: userId, post: postId });

    if (existingSavedPost) {
      // Unsave
      await SavedPost.deleteOne({ _id: existingSavedPost._id });
      return res.status(200).json({ saved: false, msg: 'Post unsaved successfully' });
    } else {
      // Save
      await SavedPost.create({ user: userId, post: postId });
      return res.status(201).json({ saved: true, msg: 'Post saved successfully' });
    }
  } catch (err) {
    console.error('Error toggling saved post:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get user's saved posts
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ msg: 'User not authenticated' });

    const savedPosts = await SavedPost.find({ user: userId }).populate({
        path: 'post',
        populate: {
            path: 'user', // Populate the user within the post
            select: 'username profilePic name'
        }
    }).sort({ createdAt: -1 });

    res.json(savedPosts.map(sp => sp.post)); // Return just the post objects
  } catch (err) {
    console.error('Error fetching saved posts:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Check if a post is saved by the current user
router.get('/status/:postId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { postId } = req.params;
        const userId = req.userId;

        if (!userId) return res.status(401).json({ msg: 'User not authenticated' });

        const isSaved = await SavedPost.exists({ user: userId, post: postId });
        res.json({ isSaved: !!isSaved });
    } catch (err) {
        console.error('Error checking saved post status:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

export default router;