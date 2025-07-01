// src/routes/listingRoutes.ts
import mongoose from 'mongoose';
import express, { Request, Response } from 'express';
import Listing from '../models/Listing'; // Adjust path if needed
import { authenticateToken } from '../middleware/auth'; // Adjust path if needed
import asyncHandler from '../utils/asyncHandler'; // Import asyncHandler

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// Helper to safely get error message (optional, but good practice if not using a centralized error handler)
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error);
}

// 1) AUTOCOMPLETE CITIES
router.get('/autocomplete/cities', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const rawQuery = req.query.query;
    if (!rawQuery || typeof rawQuery !== 'string') {
        res.status(400).json({ msg: 'Missing or invalid query parameter.' });
        return; // Early exit
    }

    const regex = new RegExp(rawQuery, 'i');
    const docs = await Listing.find({ city: regex })
        .limit(50)
        .select('city country')
        .lean();

    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const doc of docs) {
        if (doc.city && doc.country) {
            const combo = `${doc.city}, ${doc.country}`;
            if (!seen.has(combo)) {
                seen.add(combo);
                suggestions.push(combo);
                if (suggestions.length >= 10) break;
            }
        }
    }
    res.json(suggestions); // No return here
}));

// 2) AUTOCOMPLETE COUNTRIES
router.get('/autocomplete/countries', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const rawQuery = req.query.query;
    if (!rawQuery || typeof rawQuery !== 'string') {
        res.status(400).json({ msg: 'Missing or invalid query parameter.' });
        return; // Early exit
    }

    const regex = new RegExp(rawQuery, 'i');
    const allMatchingCountries: string[] = await Listing.find({ country: regex }).distinct('country');
    const limitedCountries = allMatchingCountries.slice(0, 10);

    res.json(limitedCountries); // No return here
}));

// 3) CREATE LISTING
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log('=== CREATE LISTING endpoint hit ===');
    console.log('Headers:', req.headers);
    console.log('Raw Request Body:', req.body); // Log the incoming body

    const {
        title, details, type, amenities, city, country,
        roommates, tags, availability, images, status, thumbnail, features, petTypes
    } = req.body;
    const userId = req.userId; // Assuming authenticateToken sets req.userId

    // Basic validation
    if (!userId) {
        res.status(401).json({ msg: 'User not authenticated' });
        return;
    }
    if (!title || !details || !type || !city || !country || !images || images.length === 0 || !thumbnail) {
        res.status(400).json({ msg: 'Missing required listing fields (title, details, type, city, country, images, thumbnail).' });
        return;
    }

    // --- Correctly format availability array for Mongoose ---
    const formattedAvailability = Array.isArray(availability)
        ? availability.map((dateString: string) => {
            // Ensure dateString is valid before creating Date object
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date format for availability: ${dateString}`);
            }
            return {
                startDate: date,
                endDate: date,
            };
        })
        : [];

    // --- Debugging Logs for Availability (Now correctly placed) ---
    console.log('*** Debugging Availability: ***');
    console.log('Original availability from request body:', availability);
    console.log('Type of original availability:', typeof availability, Array.isArray(availability) ? ' (is Array)' : ' (is NOT Array)');
    console.log('Content of formattedAvailability before Listing.create:', formattedAvailability);
    console.log('Type of formattedAvailability:', typeof formattedAvailability, Array.isArray(formattedAvailability) ? ' (is Array)' : ' (is NOT Array)');
    if (Array.isArray(formattedAvailability) && formattedAvailability.length > 0) {
        console.log('First element of formattedAvailability:', formattedAvailability[0]);
        console.log('Type of startDate in first element:', typeof formattedAvailability[0].startDate);
    }
    console.log('***************************');
    // --- End Debugging Logs ---

    // --- Create the listing with correctly formatted data ---
    const newListing = await Listing.create({
        user: userId,
        title,
        details,
        type,
        amenities: amenities || [], // Ensure defaults for optional arrays
        features: features || [],
        city,
        country,
        roommates: roommates || [],
        tags: tags || [],
        availability: formattedAvailability, // <--- This is the crucial fix
        images,
        thumbnail,
        status,
        petTypes: petTypes || [],
    });

    res.status(201).json(newListing); // Send response once after successful creation
}));

// 4) GET ALL LISTINGS WITH FILTERS
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
        search, startDate, endDate, countries, cities, type,
        bedroomOnly, liveWithFamily, womenOnly, dogsAllowed, catsAllowed, tags,
        amenities, features
    } = req.query;

    const query: any = { status: 'published' };
    let tagsArray: string[] = [];

    if (search && typeof search === 'string') {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { title: searchRegex },
            { details: searchRegex },
            { city: searchRegex },
            { country: searchRegex },
        ];
    }

    if (countries && typeof countries === 'string') {
        const countryList = countries.split(',').map(c => c.trim());
        if (countryList.length > 0) {
            if (query.$or) {
                query.$or = query.$or.filter((cond: any) =>
                    !cond.hasOwnProperty('country')
                );
                if (query.$or.length === 0) delete query.$or;
            }
            query.country = { $in: countryList };
        }
    }

    if (cities && typeof cities === 'string') {
        const cityList = cities.split(',').map(c => c.trim());
        if (cityList.length > 0) {
            if (query.$or) {
                query.$or = query.$or.filter((cond: any) =>
                    !cond.hasOwnProperty('city')
                );
                if (query.$or.length === 0) delete query.$or;
            }
            query.city = { $in: cityList };
        }
    }

    if (query.$or && query.$or.length === 0) {
        delete query.$or;
    }

    if (
        startDate && typeof startDate === 'string' &&
        endDate && typeof endDate === 'string'
    ) {
        const searchStart = new Date(startDate);
        const searchEnd = new Date(endDate);
        if (isNaN(searchStart.getTime()) || isNaN(searchEnd.getTime())) {
            res.status(400).json({ msg: 'Invalid date format for startDate or endDate.' });
            return; // Early exit
        }
        query['availability.startDate'] = { $lte: searchEnd };
        query['availability.endDate'] = { $gte: searchStart };
    }

    if (type && typeof type === 'string') {
        const allowedTypes = ['Single Room', 'Whole Apartment', 'Whole House'];
        if (allowedTypes.includes(type)) {
            query.type = type;
        }
    }

    if (bedroomOnly === 'true') {
        query.type = 'Single Room';
    }

    if (liveWithFamily === 'true') {
        tagsArray.push('live-with-family');
    }
    if (womenOnly === 'true') {
        tagsArray.push('women-only');
    }

    if (typeof tags === 'string' && tags.includes('Pets Allowed')) {
        tagsArray.push('pets-allowed');
        if (tags.includes('dogs')) tagsArray.push('dogs-allowed');
        if (tags.includes('cats')) tagsArray.push('cats-allowed');
    }

    if (dogsAllowed === 'true') {
        tagsArray.push('dogs-allowed');
    }
    if (catsAllowed === 'true') {
        tagsArray.push('cats-allowed');
    }

    if (amenities && typeof amenities === 'string') {
        const amenityList = amenities.split(',').map(a => a.trim()).filter(Boolean);
        if (amenityList.length > 0) {
            query.amenities = { $all: amenityList };
        }
    }

    if (features && typeof features === 'string') {
        const featureList = features.split(',').map(f => f.trim()).filter(Boolean);
        tagsArray = [...tagsArray, ...featureList];
    }

    if (tagsArray.length > 0) {
        query.tags = { $all: tagsArray };
    }

    console.log('Final MongoDB Query:', JSON.stringify(query, null, 2));
    const listings = await Listing.find(query).populate('user');
    res.json(listings); // No return here
}));

// 5) GET SINGLE LISTING BY ID
router.get('/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const listing = await Listing.findById(req.params.id).populate('user'); // Populate user to show host details
    if (!listing) {
        res.status(404).json({ msg: 'Listing not found' });
        return; // Early exit
    }
    res.json(listing); // No return here
}));

// 6) GET USER-SPECIFIC LISTINGS
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const listings = await Listing.find({
        user: req.params.userId,
        status: 'published'
    }).populate('user');
    res.json(listings); // No return here
}));

// 7) UPDATE LISTING
router.patch('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.userId; // ID of the authenticated user

    // Find the listing by ID
    const listing = await Listing.findById(id);

    if (!listing) {
        res.status(404).json({ msg: 'Listing not found.' });
        return; // Early exit
    }

    // Check if the authenticated user is the owner of the listing
    if (listing.user.toString() !== userId) {
        res.status(403).json({ msg: 'Unauthorized: You do not own this listing.' });
        return; // Early exit
    }

    // Update listing fields from req.body
    const updates = req.body;
    const allowedUpdates = [
        'title', 'details', 'type', 'amenities', 'city', 'country',
        'roommates', 'tags', 'availability', 'images', 'thumbnail', 'status'
    ];

    Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
            (listing as any)[key] = updates[key]; // Type assertion for flexibility
        }
    });

    await listing.save();
    res.json(listing); // No return here
}));

// 8) DELETE LISTING
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.userId; // ID of the authenticated user

    const listing = await Listing.findById(id);

    if (!listing) {
        res.status(404).json({ msg: 'Listing not found.' });
        return; // Early exit
    }

    // Check if the authenticated user is the owner of the listing
    if (listing.user.toString() !== userId) {
        res.status(403).json({ msg: 'Unauthorized: You do not own this listing.' });
        return; // Early exit
    }

    await Listing.deleteOne({ _id: id }); // Or listing.remove() for Mongoose < 6.x
    res.json({ msg: 'Listing deleted successfully.' }); // No return here
}));

export default router;