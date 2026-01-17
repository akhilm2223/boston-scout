import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;

if (!MONGODB_URI || !GOOGLE_MAPS_API_KEY) {
    console.error('❌ Missing environment variables');
    process.exit(1);
}

const PLACE_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

async function searchGooglePlace(query) {
    try {
        const response = await axios.get(PLACE_SEARCH_URL, {
            params: {
                query: `${query} Boston`,
                key: GOOGLE_MAPS_API_KEY
            }
        });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const firstResult = response.data.results[0];
            if (firstResult.photos && firstResult.photos.length > 0) {
                return firstResult.photos[0].photo_reference;
            }
        }
        return null;
    } catch (error) {
        console.error(`Error searching for ${query}:`, error.message);
        return null;
    }
}

async function enrichImages() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('✓ Connected to MongoDB');

        const db = client.db('boston_database');
        const restaurants = db.collection('boston_restaurants');
        const events = db.collection('boston_events');

        // 1. Enrich Restaurants
        console.log('\n--- Enriching Restaurants ---');
        // Find those without photo_name or with empty string
        const missingRestaurants = await restaurants.find({
            $or: [
                { photo_name: { $exists: false } },
                { photo_name: '' },
                { photo_name: null }
            ]
        }).toArray(); // Processing ALL records

        console.log(`Found ${missingRestaurants.length} restaurants to process (FULL BATCH)`);

        let rUpdated = 0;
        for (const r of missingRestaurants) {
            console.log(`[${rUpdated + 1}/${missingRestaurants.length}] Searching for: ${r.businessname}...`);
            const photoRef = await searchGooglePlace(r.businessname || r.name);

            if (photoRef) {
                await restaurants.updateOne(
                    { _id: r._id },
                    { $set: { photo_name: photoRef, photo_source: 'google_places_api' } }
                );
                console.log(`  ✓ Updated photo for ${r.businessname}`);
                rUpdated++;
            } else {
                console.log(`  x No photo found for ${r.businessname}`);
            }
            // Delay to respect API limits
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log(`Updated ${rUpdated} restaurants.`);

        // 2. Enrich Events
        console.log('\n--- Enriching Events ---');
        // Find those without photo_name
        const missingEvents = await events.find({
            $or: [
                { photo_name: { $exists: false } },
                { photo_name: '' }
            ]
        }).toArray();

        console.log(`Found ${missingEvents.length} events to process (FULL BATCH)`);

        let eUpdated = 0;
        for (const e of missingEvents) {
            const query = e.venueName || e.title;
            console.log(`[${eUpdated + 1}/${missingEvents.length}] Searching for: ${query}...`);
            const photoRef = await searchGooglePlace(query);

            if (photoRef) {
                await events.updateOne(
                    { _id: e._id },
                    { $set: { photo_name: photoRef, photo_source: 'google_places_api' } }
                );
                console.log(`  ✓ Updated photo for ${e.title}`);
                eUpdated++;
            } else {
                console.log(`  x No photo found for ${e.title}`);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log(`Updated ${eUpdated} events.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

enrichImages();
