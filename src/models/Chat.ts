// src/models/Chat.ts
import mongoose, { Schema, Document } from "mongoose";
import { IMessage } from "./Message"; // Assuming you have this interface

export interface IChat extends Document {
  members: mongoose.Types.ObjectId[];
  messages: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId | IMessage; // For clarity when populated
  isGroup: boolean;
  groupName?: string; // Name for group chats
  groupDescription?: string; // Description for group chats
  admins: mongoose.Types.ObjectId[]; // Array of admin user IDs
  createdBy: mongoose.Types.ObjectId; // User who created the group
  groupImage?: string; // Optional group image URL
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, required: function() { return this.isGroup; } },
    groupDescription: { type: String },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: function() { return this.isGroup; } },
    groupImage: { type: String }
  },
  { timestamps: true }
);

// Index for better query performance
chatSchema.index({ members: 1 });
chatSchema.index({ isGroup: 1 });
chatSchema.index({ admins: 1 });

const Chat = mongoose.model<IChat>("Chat", chatSchema);

export default Chat;