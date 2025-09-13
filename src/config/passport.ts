import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/oauth/google/callback',
    passReqToCallback: true // This allows us to access the request object
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google OAuth profile:', profile);
        
        // Extract referral code and invite token from state parameter or query
        let referralCode = req.query.ref;
        let inviteToken = req.query.inviteToken;
        
        // Parse state parameter if it's a JSON string
        if (req.query.state && typeof req.query.state === 'string') {
            try {
                const stateObj = JSON.parse(req.query.state);
                referralCode = stateObj.ref || referralCode;
                inviteToken = stateObj.inviteToken || inviteToken;
            } catch (err) {
                // If parsing fails, treat state as referral code (backward compatibility)
                referralCode = req.query.state;
            }
        }
        
        console.log('Referral code from OAuth:', referralCode);
        console.log('Invite token from OAuth:', inviteToken);
        
        // Determine role from inviteToken
        let role: 'user' | 'ambassador' = 'user';
        if (inviteToken && typeof inviteToken === 'string') {
            try {
                const payload = jwt.verify(inviteToken, process.env.JWT_SECRET!) as any;
                if (payload.role === 'ambassador') {
                    role = 'ambassador';
                    console.log('Ambassador invite token validated, setting role to ambassador');
                }
            } catch (err) {
                console.log('Invalid or expired invite token:', err);
                // Don't fail the OAuth process if invite token is invalid
            }
        }
        
        // Check if user already exists with this Google ID
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) {
            // User exists, update last login
            user.lastLogin = new Date();
            await user.save();
            return done(null, user);
        }
        
        // Check if user exists with same email
        const existingUser = await User.findOne({ email: profile.emails?.[0]?.value });
        
        if (existingUser) {
            // Link Google account to existing user
            existingUser.googleId = profile.id;
            existingUser.isGoogleUser = true;
            existingUser.lastLogin = new Date();
            await existingUser.save();
            return done(null, existingUser);
        }
        
        // Generate unique username if needed
        let username = profile.emails?.[0]?.value?.split('@')[0] || profile.displayName?.toLowerCase().replace(/\s+/g, '');
        let usernameExists = await User.findOne({ username });
        let counter = 1;
        
        while (usernameExists) {
            username = `${username}${counter}`;
            usernameExists = await User.findOne({ username });
            counter++;
        }
        
        // Generate unique referral code
        let referralCodeForUser = username.toLowerCase();
        let referralCodeExists = await User.findOne({ referralCode: referralCodeForUser });
        counter = 1;
        
        while (referralCodeExists) {
            referralCodeForUser = `${username.toLowerCase()}${counter}`;
            referralCodeExists = await User.findOne({ referralCode: referralCodeForUser });
            counter++;
        }
        
        // Create new user
        const newUser = new User({
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            username: username,
            referralCode: referralCodeForUser,
            role: role, // Set role based on invite token
            isGoogleUser: true,
            isEmailVerified: true, // Google emails are pre-verified
            profilePic: profile.photos?.[0]?.value,
            lastLogin: new Date(),
            points: 0
        });
        
        await newUser.save();
        console.log('New Google user created:', newUser);
        
        // Handle referral code if provided
        if (referralCode && typeof referralCode === 'string') {
            try {
                const referrer = await User.findOne({ referralCode: referralCode });
                
                if (referrer && referrer._id.toString() !== newUser._id.toString()) {
                    // Apply referral
                    newUser.referredBy = referralCode;
                    newUser.points = 5; // Bonus points for being referred
                    referrer.points = (referrer.points || 0) + 10; // Bonus points for referring
                    
                    await newUser.save();
                    await referrer.save();
                    
                    console.log(`Referral applied: ${referrer.username} referred ${newUser.username}`);
                }
            } catch (referralError) {
                console.error('Error applying referral code:', referralError);
                // Don't fail the OAuth process if referral fails
            }
        }
        
        return done(null, newUser);
        
    } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error as any, undefined);
    }
}));

// Serialize user for session
passport.serializeUser((user: any, done) => {
    done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;
