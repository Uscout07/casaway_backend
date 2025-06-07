// models/SavedPost.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface ISavedPost extends Document {
  user: mongoose.Types.ObjectId;
  post: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SavedPostSchema: Schema = new Schema<ISavedPost>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  createdAt: { type: Date, default: Date.now },
});

// Ensure a user can only save a specific post once
SavedPostSchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.models.SavedPost || mongoose.model<ISavedPost>('SavedPost', SavedPostSchema);