import express, { Request, Response } from 'express';
import multer from 'multer';
import Story from '../models/stories';
import { authenticateToken } from '../middleware/auth';
import User from '../models/User';
import { uploadToS3 } from '../utils/s3';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/stories - upload a new story
router.post('/upload', authenticateToken, upload.single('media'), async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found in request. Authentication failed.' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded.' });
        return;
    }

    const mediaUrl = await uploadToS3(req.file);
    const caption = req.body.caption || '';
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

    const story = await Story.create({
      user: user._id,
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

// DELETE /api/stories/:id - delete a story
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found in request. Authentication failed.' });
      return;
    }

    const storyId = req.params.id;

    // Find the story and check if the user owns it
    const story = await Story.findById(storyId);
    if (!story) {
      res.status(404).json({ message: 'Story not found.' });
      return;
    }

    // Check if the user owns the story
    if (story.user.toString() !== userId) {
      res.status(403).json({ message: 'You can only delete your own stories.' });
      return;
    }

    // Delete the story
    await Story.findByIdAndDelete(storyId);

    res.status(200).json({ message: 'Story deleted successfully' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Failed to delete story' });
  }
});

export default router;