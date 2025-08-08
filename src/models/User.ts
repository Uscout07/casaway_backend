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
}

// User schema for MongoDB collection
const userSchema = new Schema<IUser>(
  {
    // Basic profile information
    name: { type: String, required: false },
    username: { type: String, required: true, unique: true }, // Unique username for login/profile
    email: { type: String, required: true, unique: true }, // Unique email for authentication
    password: { type: String, required: true }, // Hashed password

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
  },
  { timestamps: true } // Automatically manage createdAt and updatedAt
);

// User model for database operations
const User = mongoose.model<IUser>("User", userSchema);

export default User;