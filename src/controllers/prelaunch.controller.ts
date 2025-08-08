import { Request, Response } from 'express';
import User from '../models/User';

export const completeProfile = async (req: Request, res: Response): Promise<void> => {
  const { dream_countries, dream_cities, swap_dates, bio, city, country } = req.body;
  const userId = (req as any).user.id;

  try {
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.dream_countries = dream_countries;
    user.dream_cities = dream_cities;
    user.swap_dates = swap_dates;
    user.bio = bio;
    user.city = city;
    user.country = country;

    if (city && country) {
      try {
        const geocodeRes = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&format=json&limit=1`);
        const geocodeData = await geocodeRes.json();
        if (geocodeData && geocodeData.length > 0) {
          user.latitude = parseFloat(geocodeData[0].lat);
          user.longitude = parseFloat(geocodeData[0].lon);
        }
      } catch (geocodeError) {
        console.error('Error geocoding location:', geocodeError);
        // Continue without coordinates if geocoding fails
      }
    }

    user.prelaunch_completed = true;

    await user.save();

    res.status(200).json({ message: 'Pre-launch profile completed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ prelaunch_completed: true }).select('city country latitude longitude');
    
    const uniqueLocations = new Map();
    users.forEach(user => {
      if (user.city && user.latitude && user.longitude) {
        const key = `${user.city},${user.country}`;
        if (!uniqueLocations.has(key)) {
          uniqueLocations.set(key, {
            city: user.city,
            country: user.country,
            latitude: user.latitude,
            longitude: user.longitude
          });
        }
      }
    });

    res.status(200).json(Array.from(uniqueLocations.values()));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};