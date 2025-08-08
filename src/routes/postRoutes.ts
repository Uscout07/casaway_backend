// src/routes/postRoutes.ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import Post from '../models/Post'; // Assuming you have a Post model defined
import { authenticateToken } from '../middleware/auth'; // Assuming auth middleware exists
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler'; // Import asyncHandler
import { uploadToS3 } from '../utils/s3';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// Create a new post
// POST /api/posts — now receives JSON with image URLs
router.post('/', authenticateToken, upload.array('images', 10), asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log('=== /api/posts HIT (Receiving JSON) ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body); // req.body will now contain imageUrl and images directly

    const { caption, city, country, status } = req.body;
    const userId = req.userId; // Retrieve userId from the request set by authenticateToken

    const tagsRaw = req.body.tags;
    const tags: string[] =
      Array.isArray(tagsRaw) ? tagsRaw :
      typeof tagsRaw === 'string' ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) :
      [];

    if (!caption || !city || !country || !status || !userId || !req.files || (req.files as Express.Multer.File[]).length === 0) {
      res.status(400).json({ msg: 'Missing required fields (caption, city, country, status, userId, images).' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    const imageUrls = await Promise.all(files.map(file => uploadToS3(file)));

    const newPost = await Post.create({
      user: userId, // Associate post with the authenticated user
      caption,
      city,
      country,
      status,
      tags,
      imageUrl: imageUrls[0], // Directly use imageUrl from body
      images: imageUrls,     // Directly use images array from body
    });

    console.log('✅ Post saved to database:', newPost);
    res.status(201).json({ msg: 'Post created successfully', post: newPost });
}));


// Get all posts (optionally filter by city/tags)
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { tags, city } = req.query;
    const query: any = {};

    if (city && typeof city === 'string') query.city = city;
    if (tags && typeof tags === 'string') {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
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
        return;
    }

    const posts = await Post.find({ tags: { $regex: query, $options: 'i' } }).select('tags').lean();
    const allTags = posts.flatMap(p => p.tags || []);
    const uniqueTags = [...new Set(allTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase())))];
    res.json(uniqueTags.slice(0, 10));
}));

// Update a post by ID
// This route will continue to expect updates in JSON format.
router.patch('/:id', authenticateToken, upload.array('images', 10), asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;
    const allowedUpdates = ['caption', 'tags', 'city', 'country', 'status'];

    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ msg: 'Invalid post ID format.' });
        return;
    }

    const post = await Post.findById(id);
    if (!post) {
        res.status(404).json({ msg: 'Post not found.' });
        return;
    }

    if (post.user.toString() !== req.userId) {
        res.status(403).json({ msg: 'Unauthorized to update this post.' });
        return;
    }

    const files = req.files as Express.Multer.File[];
    let newImageUrls: string[] = [];
    if (files && files.length > 0) {
        newImageUrls = await Promise.all(files.map(file => uploadToS3(file)));
    }

    Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
            (post as any)[key] = updates[key];
        }
    });

    if (newImageUrls.length > 0) {
        post.images = [...post.images, ...newImageUrls];
        if (!post.imageUrl) {
            post.imageUrl = newImageUrls[0];
        }
    }

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
        return;
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
        return;
    }

    if (post.user.toString() !== req.userId) {
        res.status(403).json({ msg: 'Unauthorized to delete this post.' });
        return;
    }

    await Post.findByIdAndDelete(id);
    res.json({ msg: 'Post deleted successfully.' });
}));

export default router;