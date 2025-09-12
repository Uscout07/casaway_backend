import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/oauth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google OAuth profile:', profile);
        
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
        
        // Create new user
        const newUser = new User({
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            username: profile.emails?.[0]?.value?.split('@')[0] || profile.displayName?.toLowerCase().replace(/\s+/g, ''),
            isGoogleUser: true,
            isEmailVerified: true, // Google emails are pre-verified
            profilePicture: profile.photos?.[0]?.value,
            lastLogin: new Date()
        });
        
        await newUser.save();
        console.log('New Google user created:', newUser);
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
