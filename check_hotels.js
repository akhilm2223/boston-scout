import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkHotels() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('✓ Connected to MongoDB');

        const db = client.db('boston_database');

        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\n📂 All collections:');
        collections.forEach(col => console.log(`  - ${col.name}`));

        // Check for hotel-related collections
        const hotelCollections = collections.filter(c =>
            c.name.toLowerCase().includes('hotel')
        );

        console.log('\n🏨 Hotel-related collections:');
        if (hotelCollections.length === 0) {
            console.log('  ❌ No hotel collections found');
        } else {
            for (const col of hotelCollections) {
                const count = await db.collection(col.name).countDocuments();
                console.log(`  - ${col.name}: ${count} documents`);

                if (count > 0) {
                    const sample = await db.collection(col.name).findOne();
                    console.log(`    Sample fields:`, Object.keys(sample).join(', '));
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

checkHotels();
