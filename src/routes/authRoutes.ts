import express from 'express';
import passport from '../config/passport';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Google OAuth routes (stateless: no server-side sessions)
router.get(
  '/google',
  (req, res, next) => {
    // Extract referral code and invite token from query parameters
    const referralCode = req.query.ref;
    const inviteToken = req.query.inviteToken;
    
    // Build state parameter with both referral code and invite token
    let state = undefined;
    if (referralCode || inviteToken) {
      const stateObj: any = {};
      if (typeof referralCode === 'string') stateObj.ref = referralCode;
      if (typeof inviteToken === 'string') stateObj.inviteToken = inviteToken;
      state = JSON.stringify(stateObj);
    }
    
    // Pass state parameter to Google OAuth
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state: state
    })(req, res, next);
  }
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/oauth/failure',
    session: false,
  }),
    asyncHandler(async (req: any, res: any) => {
        try {
            const user = req.user;
            
            if (!user) {
                return res.redirect('/auth/failure?error=no_user');
            }

            // Generate JWT token
            const token = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET || 'fallback_secret',
                { expiresIn: '7d' }
            );

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/auth/callback?token=${token}&success=true`);
            
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect('/api/oauth/failure?error=callback_error');
        }
    })
);

// OAuth failure route
router.get('/failure', (req: any, res: any) => {
    const error = req.query.error || 'authentication_failed';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?error=${error}&success=false`);
});

// Get current user info (for OAuth users)
router.get('/me', asyncHandler(async (req: any, res: any) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ msg: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json({
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePic: user.profilePic,
                isGoogleUser: user.isGoogleUser,
                isEmailVerified: user.isEmailVerified,
                lastLogin: user.lastLogin
            }
        });
        
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(401).json({ msg: 'Invalid token' });
    }
}));

// Link Google account to existing user
router.post('/link-google', asyncHandler(async (req: any, res: any) => {
    try {
        const { token, googleId } = req.body;
        
        if (!token || !googleId) {
            return res.status(400).json({ msg: 'Token and Google ID are required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Check if Google ID is already linked to another user
        const existingGoogleUser = await User.findOne({ googleId });
        if (existingGoogleUser && existingGoogleUser._id.toString() !== user._id.toString()) {
            return res.status(400).json({ msg: 'Google account is already linked to another user' });
        }

        // Link Google account
        user.googleId = googleId;
        user.isGoogleUser = true;
        await user.save();

        res.json({ msg: 'Google account linked successfully' });
        
    } catch (error) {
        console.error('Link Google account error:', error);
        res.status(500).json({ msg: 'Failed to link Google account' });
    }
}));

// Unlink Google account
router.post('/unlink-google', asyncHandler(async (req: any, res: any) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ msg: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (!user.isGoogleUser) {
            return res.status(400).json({ msg: 'User is not linked to Google' });
        }

        // Check if user has a password set
        if (!user.password) {
            return res.status(400).json({ 
                msg: 'Cannot unlink Google account. Please set a password first.' 
            });
        }

        // Unlink Google account
        user.googleId = undefined;
        user.isGoogleUser = false;
        await user.save();

        res.json({ msg: 'Google account unlinked successfully' });
        
    } catch (error) {
        console.error('Unlink Google account error:', error);
        res.status(500).json({ msg: 'Failed to unlink Google account' });
    }
}));

export default router;
