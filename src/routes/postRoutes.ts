// src/routes/postRoutes.ts
import express, { Request, Response } from 'express';
import Post from '../models/Post';
import { authenticateToken } from '../middleware/auth';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler'; // Import asyncHandler

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// Create a new post
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { caption, tags, city, country, imageUrl, images, status } = req.body;

    if (!req.userId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return; // Early exit
    }
    // Add basic validation for required fields if necessary
    if (!caption || !city || !country) {
        res.status(400).json({ msg: 'Caption, city, and country are required for a post.' });
        return;
    }

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
}));

// Get all posts (optionally filter by city/tags)
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { tags, city } = req.query;
    const query: any = {};

    if (city && typeof city === 'string') query.city = city;
    if (tags && typeof tags === 'string') {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean); // Filter out empty strings
        if (tagArray.length > 0) {
            query.tags = { $all: tagArray };
        }
    }

    const posts = await Post.find(query)
        .populate('user')
        .sort({ createdAt: -1 });
    res.json(posts);
}));

// Get posts by a specific user
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Validate userId if it's not a valid ObjectId (optional, asyncHandler will catch Mongoose CastErrors)
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
        res.status(400).json({ msg: 'Invalid user ID format.' });
        return;
    }

    const posts = await Post.find({ user: req.params.userId })
        .populate('user')
        .sort({ createdAt: -1 });
    res.json(posts);
}));

// Search tags (distinct)
router.get('/search/tags', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
        res.status(400).json({ msg: 'Missing search query.' });
        return; // Early exit
    }

    const posts = await Post.find({ tags: { $regex: query, $options: 'i' } }).select('tags').lean(); // Use .lean() for performance
    const allTags = posts.flatMap(p => p.tags || []);
    const uniqueTags = [...new Set(allTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase())))];
    res.json(uniqueTags.slice(0, 10));
}));

// Update a post by ID
router.patch('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;
    const allowedUpdates = ['caption', 'tags', 'city', 'country', 'imageUrl', 'images', 'status'];

    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ msg: 'Invalid post ID format.' });
        return;
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404).json({ msg: 'Post not found.' });
        return; // Early exit
    }

    // ownership check
    if (post.user.toString() !== req.userId) {
        res.status(403).json({ msg: 'Unauthorized to update this post.' });
        return; // Early exit
    }

    Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
            (post as any)[key] = updates[key]; // Type assertion for flexibility
        }
    });

    await post.save();
    res.json(post);
}));

// Get a single post by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ msg: 'Invalid post ID format.' });
        return;
    }

    const post = await Post.findById(id).populate('user');
    if (!post) {
        res.status(404).json({ msg: 'Post not found.' });
        return; // Early exit
    }
    res.json(post);
}));

// Delete a post by ID
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ msg: 'Invalid post ID format.' });
        return;
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404).json({ msg: 'Post not found.' });
        return; // Early exit
    }

    // ownership check
    if (post.user.toString() !== req.userId) {
        res.status(403).json({ msg: 'Unauthorized to delete this post.' });
        return; // Early exit
    }

    await Post.findByIdAndDelete(id);
    res.json({ msg: 'Post deleted successfully.' });
}));

export default router;