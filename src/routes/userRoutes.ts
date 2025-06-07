// src/routes/userRoutes.ts
import express, { Request, Response } from 'express';
import User from '../models/User';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  userId?: string;
}

// Updated /me route with debugging
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  console.log('=== /users/me endpoint hit ===');
  console.log('Headers:', req.headers);
  console.log('UserId from middleware:', req.userId);
  
  try {
    if (!req.userId) {
      console.error('No userId found in request after auth middleware');
      return res.status(401).json({ msg: 'Authentication failed - no user ID' });
    }

    console.log('Searching for user with ID:', req.userId);
    const user = await User.findById(req.userId).select('-password');
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.error('User not found in database with ID:', req.userId);
      return res.status(404).json({ msg: 'User not found' });
    }
    
    console.log('Returning user data for:', user.email);
    res.json(user);
  } catch (error) {
    console.error('[GET /me error]', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// Complete profile setup (NEW ROUTE)
router.post('/complete-profile', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { username, name, phone, city, country, profilePic, instagramUrl, bio } = req.body;

    // Check if username is already taken (excluding current user)
    const existingUser = await User.findOne({ 
      username: username, 
      _id: { $ne: userId } 
    });
    
    if (existingUser) {
      res.status(400).json({ msg: 'Username is already taken' });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        username,
        name,
        phone,
        city,
        country,
        profilePic,
        instagramUrl,
        bio,
        isProfileComplete: true
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      res.status(404).json({ msg: 'User not found' });
      return;
    }

    res.json({
      msg: 'Profile completed successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('[POST /complete-profile error]', error);
    res.status(500).json({ msg: 'Server error', error });
  }
});

// Get user profile by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({
      ...user.toObject(),
      isSelf: user._id.toString() === req.userId, // helpful for frontend UI logic
    });
  } catch (err) {
    console.error('[GET /:id error]', err);
    res.status(500).json({ msg: 'Server error', error: err });
  }
});

// Get followers
router.get('/:id/followers', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).populate('followers', 'name username profilePic');
    if (!user) {
      res.status(404).json({ msg: 'User not found' });
      return;
    }
    res.json(user.followers);
  } catch (err) {
    console.error('[GET /:id/followers error]', err);
    res.status(500).json({ msg: 'Server error', error: err });
  }
});

// Get following
router.get('/:id/following', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).populate('following', 'name username profilePic');
    if (!user) {
      res.status(404).json({ msg: 'User not found' });
      return;
    }
    res.json(user.following);
  } catch (err) {
    console.error('[GET /:id/following error]', err);
    res.status(500).json({ msg: 'Server error', error: err });
  }
});

// Update user profile
router.put('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId?.toString();
  if (userId !== req.params.id) {
    res.status(403).json({ msg: "Not allowed to edit this user" });
    return;
  }

  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!updated) {
      res.status(404).json({ msg: 'User not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error('[PUT /:id error]', err);
    res.status(500).json({ msg: 'Server error', error: err });
  }
});

// Search users by username or name
router.get('/search/users', async (req: Request, res: Response) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ msg: 'Missing search query' });
  }

  const regex = new RegExp(query, 'i');
  try {
    const users = await User.find({
      $or: [{ username: regex }, { name: regex }]
    }).select('username name profilePic');

    res.json(users);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ msg: 'Error searching users', error: err });
  }
});

// Edit profile route
router.patch('/edit', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const { name, username, phone, city, country, profilePic, instagramUrl } = req.body;

  try {
    // Check if username is already taken (excluding current user)
    if (username) {
      const existingUser = await User.findOne({ 
        username: username, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({ msg: 'Username is already taken' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, username, phone, city, country, profilePic, instagramUrl },
      { new: true }
    ).select('-password');

    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: 'Server error while updating profile' });
  }
});

// Get user activity
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // You'll need to import these models
    // const posts = await Post.find({ author: userId });
    // const comments = await Comment.find({ author: userId });
    // const likedPosts = await Post.find({ likedBy: userId });

    res.status(200).json({
      // posts,
      // comments,
      // likedPosts,
      message: 'Activity endpoint - implement with Post/Comment models'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Delete user account
router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Delete user
    await User.findByIdAndDelete(userId);

    // Delete user's associated data (uncomment when models are available)
    // await Post.deleteMany({ author: userId });
    // await Comment.deleteMany({ author: userId });
    // await Listing.deleteMany({ owner: userId });

    res.status(200).json({ message: 'User and associated data deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting account' });
  }
});

export default router;