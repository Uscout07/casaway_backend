import express, { Request, Response } from 'express';
import Post from '../models/Post';
import { authenticateToken } from '../middleware/auth';
import mongoose from 'mongoose';

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

// Create a new post
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const { caption, tags, city, country, imageUrl, images, status } = req.body;
  try {
    const post = await Post.create({
      user: req.userId,
      caption,
      tags,
      city,
      country,
      imageUrl,
      images,
      status,
    });
    res.status(201).json(post);
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ msg: 'Error creating post', error: err });
  }
});

// Get all posts (optionally filter by city/tags)
router.get('/', async (req: Request, res: Response) => {
  const { tags, city } = req.query;
  const query: any = {};

  if (city && typeof city === 'string') query.city = city;
  if (tags && typeof tags === 'string') {
    const tagArray = tags.split(',').map(tag => tag.trim());
    query.tags = { $all: tagArray };
  }

  try {
    const posts = await Post.find(query)
      .populate('user')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ msg: 'Error fetching posts', error: err });
  }
});

// Get posts by a specific user
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .populate('user')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error('Error fetching user posts:', err);
    res.status(500).json({ msg: 'Error fetching user posts', error: err });
  }
});

// Search tags (distinct)
router.get('/search/tags', async (req: Request, res: Response) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ msg: 'Missing search query' });
  }
  try {
    const posts = await Post.find({ tags: { $regex: query, $options: 'i' } }).select('tags');
    const allTags = posts.flatMap(p => p.tags || []);
    const uniqueTags = [...new Set(allTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase())))];
    res.json(uniqueTags.slice(0, 10));
  } catch (err) {
    console.error('Error searching tags:', err);
    res.status(500).json({ msg: 'Error searching tags', error: err });
  }
});

// Update a post by ID
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const allowedUpdates = ['caption', 'tags', 'city', 'country', 'imageUrl', 'images', 'status'];

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // ownership check
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Unauthorized to update this post' });
    }

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        (post as any)[key] = updates[key];
      }
    });

    await post.save();
    res.json(post);
  } catch (err) {
    console.error('Error updating post:', err);
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid post ID' });
    }
    res.status(500).json({ msg: 'Error updating post', error: err });
  }
});

// Get a single post by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate('user');
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    res.json(post);
  } catch (err) {
    console.error('Error fetching post:', err);
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid post ID' });
    }
    res.status(500).json({ msg: 'Error fetching post', error: err });
  }
});

// Delete a post by ID
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // ownership check
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Unauthorized to delete this post' });
    }

    await Post.findByIdAndDelete(id);
    res.json({ msg: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err);
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid post ID' });
    }
    res.status(500).json({ msg: 'Error deleting post', error: err });
  }
});

export default router;
