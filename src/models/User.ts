import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
   username: { type: String, required: true }, // Added separate username field
  email: string;
  bio: string;
  password: string;
  profilePic?: string;
  phone?: string;
  city?: string; // Added city field
  country?: string; // Added country field
  role: "user" | "admin";
  chats: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  isProfileComplete?: boolean;
  instagramUrl: {
  type: String,
  required: false,
}
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: false },
    username: { type: String, required: true, unique: true }, // Separate username field
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: "" },
    profilePic: { type: String, default: "" },
    phone: { type: String },
    city: { type: String }, // Optional city
    country: { type: String }, // Optional country
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