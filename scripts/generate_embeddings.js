/**
 * Generate Embeddings for Places (JavaScript version)
 * 
 * Run: node scripts/generate_embeddings.js
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 1000;

/**
 * Create semantic text for a place to embed
 */
function createSemanticText(place) {
  const parts = [];

  // Business name and categories
  parts.push(place.businessname);

  if (place.categories) {
    const cats = typeof place.categories === 'string'
      ? place.categories
      : place.categories.join(', ');
    parts.push(`- ${cats}`);
  }

  if (place.city) {
    parts.push(`in ${place.city}`);
  }

  // Build features list
  const features = [];
  if (place.outdoor_seating) features.push('outdoor seating');
  if (place.good_for_groups) features.push('good for groups');
  if (place.dine_in) features.push('dine-in');
  if (place.takeout) features.push('takeout');
  if (place.delivery) features.push('delivery');
  if (place.serves_breakfast) features.push('breakfast');
  if (place.serves_lunch) features.push('lunch');
  if (place.serves_dinner) features.push('dinner');
  if (place.serves_brunch) features.push('brunch');
  if (place.reservable) features.push('reservations available');

  if (features.length > 0) {
    parts.push(`Features: ${features.join(', ')}`);
  }

  // Rating and price context
  if (place.rating) {
    if (place.rating >= 4.5) parts.push('Highly rated');
    else if (place.rating >= 4.0) parts.push('Well reviewed');
  }

  if (place.price_level) {
    const priceDesc = ['budget-friendly', 'moderate', 'upscale', 'fine dining'][place.price_level - 1] || '';
    if (priceDesc) parts.push(priceDesc);
  }

  return parts.join('. ');
}

/**
 * Get embedding from Gemini API
 */
async function getEmbedding(text) {
  try {
    const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text }]
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Embedding API error: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    return data.embedding?.values || null;
  } catch (error) {
    console.error('Embedding error:', error);
    return null;
  }
}

/**
 * Process a batch of places
 */
async function processBatch(places, collection, batchNum, totalBatches) {
  let success = 0;
  let failed = 0;

  console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${places.length} places)`);

  for (const place of places) {
    const semanticText = createSemanticText(place);
    const embedding = await getEmbedding(semanticText);

    if (embedding) {
      await collection.updateOne(
        { _id: place._id },
        { $set: { embedding, semantic_text: semanticText } }
      );
      success++;
      process.stdout.write('.');
    } else {
      failed++;
      process.stdout.write('x');
    }

    // Small delay between individual requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nBatch ${batchNum}: ${success} success, ${failed} failed`);
  return { success, failed };
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Place Embeddings Generator');
  console.log('='.repeat(60));

  if (!MONGODB_URI || !GEMINI_API_KEY) {
    console.error('Error: MONGODB_URI and GEMINI_API_KEY must be set in .env');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('boston_database');
    const collection = db.collection('boston_places');

    // Get all places without embeddings
    const places = await collection
      .find({ embedding: { $exists: false } })
      .toArray();

    const totalPlaces = places.length;
    const totalBatches = Math.ceil(totalPlaces / BATCH_SIZE);

    console.log(`\nFound ${totalPlaces} places without embeddings`);
    console.log(`Will process in ${totalBatches} batches of ${BATCH_SIZE}`);

    if (totalPlaces === 0) {
      console.log('All places already have embeddings!');
      return;
    }

    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalPlaces);
      const batch = places.slice(batchStart, batchEnd);

      const { success, failed } = await processBatch(batch, collection, i + 1, totalBatches);
      totalSuccess += success;
      totalFailed += failed;

      // Delay between batches
      if (i < totalBatches - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total processed: ${totalSuccess + totalFailed}`);
    console.log(`Success: ${totalSuccess}`);
    console.log(`Failed: ${totalFailed}`);

    // Verify embeddings
    const withEmbeddings = await collection.countDocuments({ embedding: { $exists: true } });
    console.log(`\nPlaces with embeddings: ${withEmbeddings}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

main();
