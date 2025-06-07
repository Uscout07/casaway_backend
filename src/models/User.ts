import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId; // Explicitly define _id from mongoose.Document
  name: string;
  username: string; // Corrected: should be string, not { type: String, ... }
  email: string;
  bio: string;
  password: string;
  profilePic?: string; // Optional string
  phone?: string;     // Optional string
  city?: string;      // Optional string
  country?: string;   // Optional string
  role: "user" | "admin";
  chats: Types.ObjectId[]; // Use Types.ObjectId for array of ObjectIds
  createdAt: Date;
  updatedAt: Date;
  followers: Types.ObjectId[]; // Use Types.ObjectId
  following: Types.ObjectId[]; // Use Types.ObjectId
  isProfileComplete?: boolean; // Optional boolean
  instagramUrl?: string; // Corrected: should be string | undefined, not { type: String, ... }
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: false },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: "" },
    profilePic: { type: String, default: "" },
    phone: { type: String },
    city: { type: String },
    country: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    chats: [{ type: mongoose.Schema.Types.ObjectId, ref: "Chat" }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    instagramUrl: { type: String, required: false },
    isProfileComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;