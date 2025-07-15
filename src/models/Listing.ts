// Listing.ts
import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    details: { type: String, required: true },
    type: { type: String, enum: ['Single Room', 'Whole Apartment', 'Whole House'], required: true },
    amenities: [{ type: String }],
    petTypes: [{type: String}],
    city: { type: String, required: true },
    country: { type: String, required: true },
    roommates: [{ type: String }], // Changed from String to Array of Strings
    tags: [{ type: String }],
    features: [{type: String}],
    availability: [
      {
        startDate: { type: Date, required: true }, // Use Date type for actual dates
        endDate: { type: Date, required: true },   // Use Date type for actual dates
      },
    ],
    images: [{ type: String }],
    thumbnail: { type: String },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    // NEW: Wi-Fi Speed fields
    wifiSpeed: {
      download: { type: Number, min: 0, default: 0 },
      upload: { type: Number, min: 0, default: 0 },
    }
  },
  { timestamps: true }
);

export default mongoose.models.Listing || mongoose.model('Listing', listingSchema);