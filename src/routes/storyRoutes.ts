import express, { Request, Response } from 'express';
import multer from 'multer';
import Story from '../models/stories';
import { authenticateToken } from '../middleware/auth';
import User, { IUser } from '../models/User'; // Import your User model and IUser interface

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

// POST /api/stories - upload a new story
router.post('/', authenticateToken, upload.single('media'), async (req: Request, res: Response) => {
  try {
    const userId = req.userId; // Access userId directly from req
    if (!userId) {
      // Don't return res.status().json(), just send and return void
      res.status(401).json({ message: 'User ID not found in request. Authentication failed.' });
      return; // Explicitly return to end function execution
    }

    const user = await User.findById(userId); // Fetch the user from the database
    if (!user) {
      res.status(404).json({ message: 'User not found.' }); // Changed to 404 for clarity
      return; // Explicitly return
    }

    const mediaUrl = `/uploads/${req.file?.filename}`;
    const caption = req.body.caption || '';
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

    const story = await Story.create({
      user: user._id, // Use user._id from the fetched user object
      mediaUrl,
      caption,
      createdAt,
      expiresAt,
      viewers: [],
    });

    res.status(201).json(story);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Error uploading story' });
  }
});


// GET /api/stories/feed
router.get('/feed', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId; // Access userId directly from req
    if (!userId) {
      res.status(401).json({ message: 'User ID not found in request. Authentication failed.' });
      return;
    }

    const user = await User.findById(userId); // Fetch the user to get their following list
    if (!user) {
      res.status(404).json({ message: 'User not found.' }); // Changed to 404
      return;
    }

    const stories = await Story.find({
      user: { $in: user.following },
      expiresAt: { $gt: new Date() },
    })
      .populate('user', 'username profilePic')
      .sort({ createdAt: -1 });

    res.json(stories);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Failed to fetch stories' });
  }
});

// NEW ROUTE: GET /api/stories/my-stories - fetch active stories for the authenticated user
router.get('/my-stories', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found, authentication required.' });
      return; // Changed: Removed 'return' before res.status, added explicit 'return' after
    }

    const myStories = await Story.find({
      user: userId,
      expiresAt: { $gt: new Date() }, // Only active stories
    })
      .populate('user', 'username profilePic') // Populate user details if needed
      .sort({ createdAt: -1 }); // Get the latest one first

    res.json(myStories);
  } catch (err: any) {
    console.error('Error fetching user\'s stories:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch user stories' });
  }
});


// POST /api/stories/:id/view
router.post('/:id/view', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId; // Access userId directly from req
    if (!userId) {
      res.status(401).json({ message: 'User ID not found in request. Authentication failed.' });
      return;
    }

    const storyId = req.params.id;

    await Story.updateOne(
      { _id: storyId },
      { $addToSet: { viewers: userId } } // Use userId directly
    );

    res.status(200).json({ message: 'Story marked as viewed' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Failed to mark as viewed' });
  }
});

export default router;