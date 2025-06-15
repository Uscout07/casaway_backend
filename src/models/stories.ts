import mongoose, { Document, Schema } from 'mongoose';

export interface IStory extends Document {
  user: mongoose.Types.ObjectId;
  mediaUrl: string;
  caption?: string;
  createdAt: Date;
  expiresAt: Date;
  viewers: mongoose.Types.ObjectId[];
}

const storySchema = new Schema<IStory>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mediaUrl: { type: String, required: true },
  caption: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  viewers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
});

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Story = mongoose.model<IStory>('Story', storySchema);
export default Story;
