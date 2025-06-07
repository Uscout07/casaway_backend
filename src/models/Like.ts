import mongoose, { Document, Schema } from 'mongoose';

export interface ILike extends Document {
  user: mongoose.Types.ObjectId;
  post?: mongoose.Types.ObjectId;
  listing?: mongoose.Types.ObjectId;
  comment?: mongoose.Types.ObjectId; // ✅ Add this line
  createdAt: Date;
}

const LikeSchema: Schema = new Schema<ILike>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }, // ✅ Add this line
  createdAt: { type: Date, default: Date.now },
});

// ✅ Add unique index for comment likes
LikeSchema.index(
  { user: 1, comment: 1 },
  { unique: true, partialFilterExpression: { comment: { $exists: true } } }
);

LikeSchema.index({ user: 1, post: 1 }, { unique: true, partialFilterExpression: { post: { $exists: true } } });
LikeSchema.index({ user: 1, listing: 1 }, { unique: true, partialFilterExpression: { listing: { $exists: true } } });

export default mongoose.models.Like || mongoose.model<ILike>('Like', LikeSchema);

