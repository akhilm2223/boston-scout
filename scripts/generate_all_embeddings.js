/**
 * Generate Embeddings for ALL Collections
 * - Places (restaurants)
 * - Events
 * - Reddit Posts (if not already embedded)
 * 
 * Run: node scripts/generate_all_embeddings.js
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

const BATCH_SIZE = 25;
const DELAY_BETWEEN_REQUESTS_MS = 100;
const DELAY_BETWEEN_BATCHES_MS = 2000;

// =====================================================
// SEMANTIC TEXT GENERATORS
// =====================================================

/**
 * Create semantic text for a PLACE (restaurant)
 */
function createPlaceText(place) {
  const parts = [];
  parts.push(place.businessname || 'Restaurant');

  if (place.categories) {
    const cats = typeof place.categories === 'string'
      ? place.categories
      : place.categories.join(', ');
    parts.push(cats);
  }

  if (place.city) parts.push(`in ${place.city}`);

  const features = [];
  if (place.outdoor_seating) features.push('outdoor seating patio');
  if (place.good_for_groups) features.push('good for groups large parties');
  if (place.dine_in) features.push('dine-in sit down');
  if (place.takeout) features.push('takeout to-go');
  if (place.delivery) features.push('delivery');
  if (place.serves_breakfast) features.push('breakfast morning');
  if (place.serves_lunch) features.push('lunch midday');
  if (place.serves_dinner) features.push('dinner evening');
  if (place.serves_brunch) features.push('brunch weekend');
  if (place.reservable) features.push('reservations');

  if (features.length > 0) parts.push(features.join(', '));

  if (place.rating >= 4.5) parts.push('highly rated excellent');
  else if (place.rating >= 4.0) parts.push('well reviewed popular');

  const priceDesc = ['cheap budget affordable', 'moderate mid-range', 'upscale fancy', 'fine dining luxury expensive'][
    (place.price_level || 1) - 1
  ];
  if (priceDesc) parts.push(priceDesc);

  return parts.join('. ');
}

/**
 * Create semantic text for an EVENT
 */
function createEventText(event) {
  const parts = [];
  
  // Title is most important
  parts.push(event.title);
  
  // Description (truncated)
  if (event.description) {
    parts.push(event.description.substring(0, 500));
  }
  
  // Venue info
  if (event.venue?.name) {
    parts.push(`at ${event.venue.name}`);
  }
  
  // Categories
  if (event.categories && event.categories.length > 0) {
    parts.push(`Categories: ${event.categories.join(', ')}`);
  }
  
  // Price info
  if (event.price) {
    if (event.price.toLowerCase().includes('free')) {
      parts.push('free event no cost');
    } else {
      parts.push(`Price: ${event.price}`);
    }
  }
  
  // Time context
  if (event.start_time) {
    const date = new Date(event.start_time);
    const hour = date.getHours();
    if (hour < 12) parts.push('morning event');
    else if (hour < 17) parts.push('afternoon event');
    else if (hour < 21) parts.push('evening event');
    else parts.push('night event late');
    
    const day = date.getDay();
    if (day === 0 || day === 6) parts.push('weekend');
    else parts.push('weekday');
  }
  
  return parts.join('. ');
}

/**
 * Create semantic text for a REDDIT POST
 */
function createRedditText(post) {
  const parts = [];
  
  parts.push(post.title);
  
  if (post.selftext || post.text) {
    const text = (post.selftext || post.text).substring(0, 800);
    parts.push(text);
  }
  
  if (post.subreddit) {
    parts.push(`from r/${post.subreddit}`);
  }
  
  if (post.categories && post.categories.length > 0) {
    parts.push(`Topics: ${post.categories.join(', ')}`);
  }
  
  if (post.locations && post.locations.length > 0) {
    parts.push(`Locations: ${post.locations.join(', ')}`);
  }
  
  if (post.isHiddenGem) {
    parts.push('hidden gem local secret recommendation');
  }
  
  // Engagement signals
  if (post.ups > 100) parts.push('popular highly upvoted');
  if (post.num_comments > 50) parts.push('active discussion many comments');
  
  return parts.join('. ');
}

// =====================================================
// EMBEDDING FUNCTION
// =====================================================

async function getEmbedding(text) {
  try {
    const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${response.status}`, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    return data.embedding?.values || null;
  } catch (error) {
    console.error('Embedding error:', error.message);
    return null;
  }
}

// =====================================================
// BATCH PROCESSOR
// =====================================================

async function processCollection(collection, collectionName, textGenerator) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${collectionName}`);
  console.log('='.repeat(60));

  // Get documents without embeddings
  const docs = await collection
    .find({ embedding: { $exists: false } })
    .toArray();

  const total = docs.length;
  console.log(`Found ${total} documents without embeddings`);

  if (total === 0) {
    console.log('✓ All documents already have embeddings!');
    return { success: 0, failed: 0 };
  }

  const totalBatches = Math.ceil(total / BATCH_SIZE);
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, total);
    const batch = docs.slice(batchStart, batchEnd);

    console.log(`\nBatch ${batchNum + 1}/${totalBatches} (${batch.length} docs)`);
    
    for (const doc of batch) {
      const semanticText = textGenerator(doc);
      const embedding = await getEmbedding(semanticText);

      if (embedding) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: { embedding, semantic_text: semanticText } }
        );
        totalSuccess++;
        process.stdout.write('.');
      } else {
        totalFailed++;
        process.stdout.write('x');
      }

      await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
    }

    console.log(` ✓ ${totalSuccess} success, ${totalFailed} failed`);

    if (batchNum < totalBatches - 1) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS}ms...`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  return { success: totalSuccess, failed: totalFailed };
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     BOSTON DATABASE - EMBEDDING GENERATOR                  ║');
  console.log('║     Generating vectors for Places, Events & Reddit        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (!MONGODB_URI || !GEMINI_API_KEY) {
    console.error('\n❌ Error: MONGODB_URI and GEMINI_API_KEY must be set in .env');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('\n✓ Connected to MongoDB');

    const db = client.db('boston_database');
    
    // Get collections
    const placesCollection = db.collection('boston_places');
    const eventsCollection = db.collection('boston_events');
    const redditCollection = db.collection('reddit_posts');

    // Count documents
    const placesCount = await placesCollection.countDocuments();
    const eventsCount = await eventsCollection.countDocuments();
    const redditCount = await redditCollection.countDocuments();

    console.log(`\n📊 Database Summary:`);
    console.log(`   Places:  ${placesCount}`);
    console.log(`   Events:  ${eventsCount}`);
    console.log(`   Reddit:  ${redditCount}`);

    const results = {
      places: { success: 0, failed: 0 },
      events: { success: 0, failed: 0 },
      reddit: { success: 0, failed: 0 }
    };

    // Process Places
    if (placesCount > 0) {
      results.places = await processCollection(
        placesCollection,
        'boston_places (Restaurants)',
        createPlaceText
      );
    }

    // Process Events
    if (eventsCount > 0) {
      results.events = await processCollection(
        eventsCollection,
        'boston_events',
        createEventText
      );
    }

    // Process Reddit Posts
    if (redditCount > 0) {
      results.reddit = await processCollection(
        redditCollection,
        'reddit_posts',
        createRedditText
      );
    }

    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('COMPLETE!');
    console.log('═'.repeat(60));
    console.log('\n📈 Results:');
    console.log(`   Places:  ${results.places.success} success, ${results.places.failed} failed`);
    console.log(`   Events:  ${results.events.success} success, ${results.events.failed} failed`);
    console.log(`   Reddit:  ${results.reddit.success} success, ${results.reddit.failed} failed`);

    // Verify final counts
    const placesWithEmbed = await placesCollection.countDocuments({ embedding: { $exists: true } });
    const eventsWithEmbed = await eventsCollection.countDocuments({ embedding: { $exists: true } });
    const redditWithEmbed = await redditCollection.countDocuments({ embedding: { $exists: true } });

    console.log('\n✓ Documents with embeddings:');
    console.log(`   Places:  ${placesWithEmbed}/${placesCount}`);
    console.log(`   Events:  ${eventsWithEmbed}/${eventsCount}`);
    console.log(`   Reddit:  ${redditWithEmbed}/${redditCount}`);

    console.log('\n📝 Next steps:');
    console.log('   1. Create vector search indexes in MongoDB Atlas');
    console.log('   2. Index names: vibe_index (places), events_vibe_index, reddit_vibe_index');
    console.log('   3. All should use path: "embedding", dimensions: 768, similarity: "cosine"');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

main();
