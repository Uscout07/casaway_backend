import express, { Request, Response } from 'express';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// This public route is for the map. 
// The path is '/' because the base path '/api/locations' is set in your main index.ts file.
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // 1. Find all users who have a city and country (not null or empty).
    const usersWithCity = await User.find({
        $and: [
            { city: { $nin: [null, ''] } },
            { country: { $nin: [null, ''] } },
        ]
    }).select('city country latitude longitude');

    const uniqueLocations = new Map();

    // 2. Process each user to find or generate coordinates.
    for (const user of usersWithCity) {
        const key = `${user.city},${user.country}`;
        if (uniqueLocations.has(key)) continue;

        // 3. If coordinates exist in the DB, use them instantly.
        if (user.latitude && user.longitude) {
            uniqueLocations.set(key, {
                city: user.city,
                country: user.country,
                latitude: user.latitude,
                longitude: user.longitude,
            });
        } else {
            // 4. If no coordinates, fetch them from the geocoding service.
            try {
                const geocodeUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(user.city!)}&country=${encodeURIComponent(user.country!)}&format=json&limit=1`;
                
                // IMPORTANT: Nominatim requires a valid User-Agent header.
                const geocodeRes = await fetch(geocodeUrl, { headers: { 'User-Agent': 'CasawayApp/1.0' } });

                const geocodeData = await geocodeRes.json();

                if (geocodeData && geocodeData.length > 0) {
                    const lat = parseFloat(geocodeData[0].lat);
                    const lon = parseFloat(geocodeData[0].lon);

                    // Add the newly found location to our list for this response.
                    uniqueLocations.set(key, { city: user.city, country: user.country, latitude: lat, longitude: lon });

                    // 5. Save the new coordinates back to the database for future efficiency.
                    await User.findByIdAndUpdate(user._id, { latitude: lat, longitude: lon });
                }
            } catch (geocodeError) {
                console.error(`[Geocoding] Failed to geocode ${key}:`, geocodeError);
            }
        }
    }

    const locations = Array.from(uniqueLocations.values());
    res.status(200).json(locations);
}));

export default router;
