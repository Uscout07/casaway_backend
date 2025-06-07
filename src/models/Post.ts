import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
  user: mongoose.Types.ObjectId;
  caption: string;
  tags: string[];
  city: string;
  country: string;
  imageUrl: string;
  images: string[]; // Array of all image URLs
  status: 'draft' | 'published'; // Add status field
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema: Schema = new Schema<IPost>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caption: { type: String, required: true },
  tags: [{ type: String }],
  city: { type: String },
  country: { type: String },
  imageUrl: { type: String, required: true }, // Main image URL
  images: [{ type: String }], // Array of all image URLs
  status: { 
    type: String, 
    enum: ['draft', 'published'], 
    default: 'published' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
PostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IPost>('Post', PostSchema);