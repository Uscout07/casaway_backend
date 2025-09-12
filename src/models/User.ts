import mongoose, { Document, Schema, Types } from "mongoose";

// User interface for TypeScript type checking
export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  username: string;
  email: string;
  bio: string;
  password: string;
  profilePic?: string;
  phone?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  role: "user" | "admin";
  chats: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  followers: Types.ObjectId[];
  following: Types.ObjectId[];
  isProfileComplete?: boolean;
  instagramUrl?: string;
  referralCode: string;
  referredBy?: string | null;
  points: number;
  prelaunch_completed: boolean;
  dream_countries: string[];
  dream_cities: string[];
  swap_dates: { start: Date; end: Date }[];
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  googleId?: string;
  isGoogleUser?: boolean;
  isEmailVerified?: boolean;
  lastLogin?: Date;
  pushToken?: string;
  platform?: string;
  
  // Notification settings
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  newMessages?: boolean;
  newFollowers?: boolean;
  appUpdates?: boolean;
  weeklyDigest?: boolean;
  securityAlerts?: boolean;
}

// User schema for MongoDB collection
const userSchema = new Schema<IUser>(
  {
    // Basic profile information
    name: { type: String, required: false },
    username: { type: String, required: true, unique: true }, // Unique username for login/profile
    email: { type: String, required: true, unique: true }, // Unique email for authentication
    password: { type: String, required: function() { return !this.isGoogleUser; } }, // Hashed password, not required for Google users

    // Profile details
    bio: { type: String, default: "" }, // User bio for profile page
    profilePic: { type: String, default: "" }, // Profile picture URL
    phone: { type: String }, // Optional phone number
    city: { type: String }, // Optional city for user location
    country: { type: String }, // Optional country for user location
    latitude: { type: Number },
    longitude: { type: Number },

    // User role and permissions
    role: {
      type: String,
      enum: ["user", "admin", "ambassador"],
      default: "user"
    }, // Role for access control

    // Chat and social features
    chats: [{ type: mongoose.Schema.Types.ObjectId, ref: "Chat" }], // List of chat IDs the user is part of
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who follow this user
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users this user follows

    // Social media and profile completion
    instagramUrl: { type: String, required: false }, // Instagram profile link for social integration
    isProfileComplete: { type: Boolean, default: false }, // Indicates if user completed profile setup

    // Referral and rewards system
    referralCode: { type: String, unique: true }, // Unique code for inviting others
    referredBy: { type: String, default: null }, // Referral code of the user who invited
    points: { type: Number, default: 0 }, // Reward points for user activity

    // Pre-launch fields
    prelaunch_completed: { type: Boolean, default: false },
    dream_countries: [{ type: String }],
    dream_cities: [{ type: String }],
    swap_dates: [{ start: Date, end: Date }],

    // Password reset fields
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },

    // Google OAuth fields
    googleId: { type: String, unique: true, sparse: true }, // sparse allows multiple null values
    isGoogleUser: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },

    // Push notification fields
    pushToken: { type: String },
    platform: { type: String },
    
    // Notification settings
    pushNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    newMessages: { type: Boolean, default: true },
    newFollowers: { type: Boolean, default: false },
    appUpdates: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: false },
    securityAlerts: { type: Boolean, default: true },
  },
  { timestamps: true } // Automatically manage createdAt and updatedAt
);

// User model for database operations
const User = mongoose.model<IUser>("User", userSchema);

export default User;