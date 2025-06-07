import mongoose from 'mongoose';
import express, { Request, Response } from 'express';
import Listing from '../models/Listing'; // Adjust path if needed
import { authenticateToken } from '../middleware/auth'; // Adjust path if needed

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// 1) AUTOCOMPLETE CITIES
router.get('/autocomplete/cities', async (req: Request, res: Response) => {
    try {
        const rawQuery = req.query.query;
        if (!rawQuery || typeof rawQuery !== 'string') {
            return res.status(400).json({ msg: 'Missing or invalid query parameter.' });
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
        return res.json(suggestions);
    } catch (err) {
        console.error('Error fetching city suggestions:', err);
        return res.status(500).json({
            msg: 'Error fetching city suggestions',
            error: err instanceof Error ? err.message : err,
        });
    }
});

// 2) AUTOCOMPLETE COUNTRIES
router.get('/autocomplete/countries', async (req: Request, res: Response) => {
    try {
        const rawQuery = req.query.query;
        if (!rawQuery || typeof rawQuery !== 'string') {
            return res.status(400).json({ msg: 'Missing or invalid query parameter.' });
        }

        const regex = new RegExp(rawQuery, 'i');
        const allMatchingCountries: string[] = await Listing.find({ country: regex }).distinct('country');
        const limitedCountries = allMatchingCountries.slice(0, 10);

        return res.json(limitedCountries);
    } catch (err) {
        console.error('Error fetching country suggestions:', err);
        return res.status(500).json({
            msg: 'Error fetching country suggestions',
            error: err instanceof Error ? err.message : err,
        });
    }
});

// 3) CREATE LISTING
router.post('/', authenticateToken, async (req, res) => {
    const userId = req.userId;
    const {
        title, details, type, amenities, city, country,
        roommates, tags, availability, images, status, thumbnail
    } = req.body;

    try {
        const listing = await Listing.create({
            user: userId, // Use userId from authenticated token
            title,
            details,
            type,
            amenities,
            city,
            country,
            roommates,
            tags,
            availability,
            images,
            status,
            thumbnail,
        });
        res.status(201).json(listing);
    } catch (err) {
        console.error('Error creating listing:', err);
        res.status(500).json({ msg: 'Error creating listing', error: err });
    }
});

// 4) GET ALL LISTINGS WITH FILTERS
router.get('/', async (req: Request, res: Response) => {
    try {
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
                return res
                    .status(400)
                    .json({ msg: 'Invalid date format for startDate or endDate.' });
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
        res.json(listings);
    } catch (err) {
        console.error('Error fetching listings:', err);
        res.status(500).json({ msg: 'Error fetching listings', error: err });
    }
});

// 5) GET SINGLE LISTING BY ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const listing = await Listing.findById(req.params.id).populate('user'); // Populate user to show host details
        if (!listing) {
            return res.status(404).json({ msg: 'Listing not found' });
        }
        res.json(listing);
    } catch (err) {
        console.error('Error fetching single listing:', err);
        if (err instanceof mongoose.Error.CastError) {
            return res.status(400).json({ msg: 'Invalid listing ID' });
        }
        res.status(500).json({ msg: 'Error fetching listing', error: err });
    }
});

// 6) GET USER-SPECIFIC LISTINGS
router.get('/user/:userId', async (req, res) => {
    try {
        const listings = await Listing.find({
            user: req.params.userId,
            status: 'published'
        }).populate('user');
        res.json(listings);
    } catch (err) {
        res.status(500).json({ msg: 'Error fetching user listings', error: err });
    }
});

// 7) UPDATE LISTING (NEW ROUTE)
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.userId; // ID of the authenticated user

        // Find the listing by ID
        const listing = await Listing.findById(id);

        if (!listing) {
            return res.status(404).json({ msg: 'Listing not found.' });
        }

        // Check if the authenticated user is the owner of the listing
        if (listing.user.toString() !== userId) {
            return res.status(403).json({ msg: 'Unauthorized: You do not own this listing.' });
        }

        // Update listing fields from req.body
        // Only allow specific fields to be updated to prevent unintended changes
        const updates = req.body;
        const allowedUpdates = [
            'title', 'details', 'type', 'amenities', 'city', 'country',
            'roommates', 'tags', 'availability', 'images', 'thumbnail', 'status'
        ];

        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                (listing as any)[key] = updates[key];
            }
        });

        await listing.save();
        res.json(listing);
    } catch (err) {
        console.error('Error updating listing:', err);
        if (err instanceof mongoose.Error.CastError) {
            return res.status(400).json({ msg: 'Invalid listing ID' });
        }
        res.status(500).json({ msg: 'Error updating listing', error: err });
    }
});

// 8) DELETE LISTING (NEW ROUTE)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.userId; // ID of the authenticated user

        const listing = await Listing.findById(id);

        if (!listing) {
            return res.status(404).json({ msg: 'Listing not found.' });
        }

        // Check if the authenticated user is the owner of the listing
        if (listing.user.toString() !== userId) {
            return res.status(403).json({ msg: 'Unauthorized: You do not own this listing.' });
        }

        await Listing.deleteOne({ _id: id }); // Or listing.remove() for Mongoose < 6.x
        res.json({ msg: 'Listing deleted successfully.' });
    } catch (err) {
        console.error('Error deleting listing:', err);
        if (err instanceof mongoose.Error.CastError) {
            return res.status(400).json({ msg: 'Invalid listing ID' });
        }
        res.status(500).json({ msg: 'Error deleting listing', error: err });
    }
});

export default router;