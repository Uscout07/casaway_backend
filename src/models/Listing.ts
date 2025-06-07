import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    details: { type: String, required: true },
    type: { type: String, enum: ['Single Room', 'Whole Apartment', 'Whole House'], required: true },
    amenities: [{ type: String }],
    city: { type: String, required: true },
    country: { type: String, required: true },
    roommates: [{ type: String }], // Changed from String to Array of Strings
    tags: [{ type: String }],
    availability: [{ type: String }], // ISO date strings like "2025-06-25"
    images: [{ type: String }],
    thumbnail: { type: String },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' }
  },
  { timestamps: true }
);

export default mongoose.models.Listing || mongoose.model('Listing', listingSchema); 