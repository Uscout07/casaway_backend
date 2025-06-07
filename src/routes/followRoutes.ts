import { Request, Response, Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import User from '../models/User';

const router = Router();

// Follow a user
router.post('/follow/:userId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const currentUserId = req.userId?.toString();
  const targetUserId = req.params.userId;

  console.log('[Follow Request] Current User ID:', currentUserId, 'Target User ID:', targetUserId);

  if (!currentUserId) {
    console.log('[Follow Error] No current user ID');
    res.status(401).json({ msg: 'Unauthorized' });
    return;
  }

  if (currentUserId === targetUserId) {
    console.log('[Follow Error] User trying to follow themselves');
    res.status(400).json({ msg: "You can't follow yourself" });
    return;
  }

  try {
    console.log('[Follow] Finding users...');
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser) {
      console.log('[Follow Error] Current user not found:', currentUserId);
      res.status(404).json({ msg: 'Current user not found' });
      return;
    }

    if (!targetUser) {
      console.log('[Follow Error] Target user not found:', targetUserId);
      res.status(404).json({ msg: 'Target user not found' });
      return;
    }

    console.log('[Follow] Users found. Current user following:', currentUser.following.length, 'Target user followers:', targetUser.followers.length);

    const targetIdStr = targetUser._id.toString();

    // Check if already following
    const isAlreadyFollowing = currentUser.following.some(id => id.toString() === targetIdStr);
    if (isAlreadyFollowing) {
      console.log('[Follow Error] Already following this user');
      res.status(400).json({ msg: 'Already following this user' });
      return;
    }

    // FIXED: Add targetUser to currentUser's following list
    // and add currentUser to targetUser's followers list
    console.log('[Follow] Adding to following/followers lists...');
    currentUser.following.push(targetUser._id);
    targetUser.followers.push(currentUser._id);

    await currentUser.save();
    await targetUser.save();

    console.log('[Follow Success] User followed successfully. New followers count:', targetUser.followers.length);

    res.json({ 
      msg: 'Followed successfully',
      isFollowing: true,
      followersCount: targetUser.followers.length,
      followingCount: currentUser.following.length
    });
  } catch (err) {
    console.error('[POST /follow error]', err);
    res.status(500).json({ msg: 'Server error', error: err?.message || err });
  }
});

// Unfollow a user
router.post('/unfollow/:userId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const currentUserId = req.userId?.toString();
  const targetUserId = req.params.userId;

  console.log('[Unfollow Request] Current User ID:', currentUserId, 'Target User ID:', targetUserId);

  if (!currentUserId) {
    console.log('[Unfollow Error] No current user ID');
    res.status(401).json({ msg: 'Unauthorized' });
    return;
  }

  if (currentUserId === targetUserId) {
    console.log('[Unfollow Error] User trying to unfollow themselves');
    res.status(400).json({ msg: "You can't unfollow yourself" });
    return;
  }

  try {
    console.log('[Unfollow] Finding users...');
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser) {
      console.log('[Unfollow Error] Current user not found:', currentUserId);
      res.status(404).json({ msg: 'Current user not found' });
      return;
    }

    if (!targetUser) {
      console.log('[Unfollow Error] Target user not found:', targetUserId);
      res.status(404).json({ msg: 'Target user not found' });
      return;
    }

    console.log('[Unfollow] Users found. Current user following:', currentUser.following.length, 'Target user followers:', targetUser.followers.length);

    const targetIdStr = targetUser._id.toString();
    const currentIdStr = currentUser._id.toString();

    // Check if not following
    const isFollowing = currentUser.following.some(id => id.toString() === targetIdStr);
    if (!isFollowing) {
      console.log('[Unfollow Error] Not following this user');
      res.status(400).json({ msg: 'Not following this user' });
      return;
    }

    // FIXED: Remove targetUser from currentUser's following list
    // and remove currentUser from targetUser's followers list
    console.log('[Unfollow] Removing from following/followers lists...');
    currentUser.following = currentUser.following.filter(id => id.toString() !== targetIdStr);
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentIdStr);

    await currentUser.save();
    await targetUser.save();

    console.log('[Unfollow Success] User unfollowed successfully. New followers count:', targetUser.followers.length);

    res.json({ 
      msg: 'Unfollowed successfully',
      isFollowing: false,
      followersCount: targetUser.followers.length,
      followingCount: currentUser.following.length
    });
  } catch (err) {
    console.error('[POST /unfollow error]', err);
    res.status(500).json({ msg: 'Server error', error: err?.message || err });
  }
});

// Check if current user is following a specific user
router.get('/status/:userId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const currentUserId = req.userId?.toString();
  const targetUserId = req.params.userId;

  if (!currentUserId) {
    res.status(401).json({ msg: 'Unauthorized' });
    return;
  }

  try {
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!currentUser) {
      res.status(404).json({ msg: 'Current user not found' });
      return;
    }

    if (!targetUser) {
      res.status(404).json({ msg: 'Target user not found' });
      return;
    }

    const isFollowing = currentUser.following.map(id => id.toString()).includes(targetUserId);
    
    res.json({ 
      isFollowing,
      followersCount: targetUser.followers.length,
      followingCount: targetUser.following.length
    });
  } catch (err) {
    console.error('[GET /status error]', err);
    res.status(500).json({ msg: 'Server error', error: err });
  }
});

export default router;