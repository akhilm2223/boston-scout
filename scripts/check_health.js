import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

async function checkHealth() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('✓ Connected to MongoDB');

        const db = client.db('boston_database');
        const restaurants = db.collection('boston_restaurants');
        const events = db.collection('boston_events');

        // Check Restaurants (looking for photo_name)
        const totalRestaurants = await restaurants.countDocuments();
        const restaurantsWithPhoto = await restaurants.countDocuments({ photo_name: { $exists: true, $ne: '' } });
        const restaurantsMissingPhoto = totalRestaurants - restaurantsWithPhoto;

        console.log('\n--- Restaurants ---');
        console.log(`Total: ${totalRestaurants}`);
        console.log(`With Photo: ${restaurantsWithPhoto}`);
        console.log(`Missing Photo: ${restaurantsMissingPhoto} (${((restaurantsMissingPhoto / totalRestaurants) * 100).toFixed(1)}%)`);

        // Check Events (looking for image or photo_url)
        const totalEvents = await events.countDocuments();
        const eventsWithImage = await events.countDocuments({
            $or: [
                { image: { $exists: true, $ne: '' } },
                { photo_url: { $exists: true, $ne: '' } },
                { imageUrl: { $exists: true, $ne: '' } }
            ]
        });
        const eventsMissingImage = totalEvents - eventsWithImage;

        console.log('\n--- Events ---');
        console.log(`Total: ${totalEvents}`);
        console.log(`With Image: ${eventsWithImage}`);
        console.log(`Missing Image: ${eventsMissingImage} (${((eventsMissingImage / totalEvents) * 100).toFixed(1)}%)`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

checkHealth();
