/**
 * Link Reddit Posts to Places
 *
 * This script matches Reddit posts from the boston subreddit to places
 * using location proximity and semantic name matching.
 *
 * Usage:
 * 1. Ensure MONGODB_URI is set in .env
 * 2. Ensure reddit_posts collection exists with scraped data
 * 3. Run: npx ts-node scripts/link_reddit_to_places.ts
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI!;

// Distance threshold for location matching (in kilometers)
const LOCATION_THRESHOLD_KM = 0.5;

// Minimum similarity score for name matching (0-1)
const NAME_SIMILARITY_THRESHOLD = 0.6;

interface Place {
  _id: ObjectId;
  businessname: string;
  latitude: number;
  longitude: number;
  categories?: string | string[];
}

interface RedditPost {
  _id: ObjectId;
  id: string;
  subreddit: string;
  title: string;
  selftext?: string;
  score: number;
  created_utc: number;
  permalink: string;
  url?: string;
  // Extracted location info
  mentioned_places?: string[];
  location?: { lat: number; lng: number };
  sentiment?: number;
}

interface RedditMention {
  postId: string;
  subreddit: string;
  title: string;
  sentiment: number;
  score: number;
  date: string;
  permalink: string;
}

/**
 * Calculate Haversine distance between two points
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLen;
}

/**
 * Extract potential place names from text
 */
function extractPlaceNames(text: string): string[] {
  // Common patterns for place mentions
  const patterns = [
    /at\s+([A-Z][a-zA-Z'\s]+)/g,
    /from\s+([A-Z][a-zA-Z'\s]+)/g,
    /([A-Z][a-zA-Z'\s]+)\s+(?:restaurant|cafe|bar|pub|diner|bistro|eatery)/gi,
    /try\s+([A-Z][a-zA-Z'\s]+)/g,
    /love\s+([A-Z][a-zA-Z'\s]+)/g,
    /recommend\s+([A-Z][a-zA-Z'\s]+)/g,
  ];

  const names: Set<string> = new Set();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name.length > 2 && name.length < 50) {
        names.add(name);
      }
    }
  }

  return Array.from(names);
}

/**
 * Estimate sentiment from text (simple heuristic)
 */
function estimateSentiment(text: string): number {
  const positiveWords = [
    'amazing', 'awesome', 'best', 'delicious', 'excellent', 'fantastic',
    'favorite', 'great', 'incredible', 'love', 'perfect', 'recommend',
    'wonderful', 'hidden gem', 'must try', 'underrated'
  ];

  const negativeWords = [
    'awful', 'bad', 'disappointing', 'horrible', 'mediocre', 'overrated',
    'skip', 'terrible', 'worst', 'avoid', 'meh', 'underwhelming'
  ];

  const lowerText = text.toLowerCase();

  let positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
  let negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;

  // Base score of 5, adjusted by positive/negative ratio
  const total = positiveCount + negativeCount;
  if (total === 0) return 5;

  const score = 5 + (positiveCount - negativeCount) * (5 / total);
  return Math.max(0, Math.min(10, score));
}

/**
 * Check if post mentions a "hidden gem"
 */
function isHiddenGemMention(text: string): boolean {
  const hiddenGemPhrases = [
    'hidden gem', 'underrated', 'under the radar', 'nobody knows about',
    'best kept secret', 'locals only', 'off the beaten path',
    'undiscovered', 'sleeper', 'overlooked'
  ];

  const lowerText = text.toLowerCase();
  return hiddenGemPhrases.some(phrase => lowerText.includes(phrase));
}

/**
 * Find matching places for a Reddit post
 */
function findMatchingPlaces(
  post: RedditPost,
  places: Place[]
): { place: Place; score: number; isHiddenGem: boolean }[] {
  const matches: { place: Place; score: number; isHiddenGem: boolean }[] = [];
  const fullText = `${post.title} ${post.selftext || ''}`;
  const extractedNames = extractPlaceNames(fullText);
  const isHiddenGem = isHiddenGemMention(fullText);

  for (const place of places) {
    // Check name similarity
    let maxSimilarity = 0;

    // Direct name match
    const nameSim = stringSimilarity(place.businessname, fullText);
    maxSimilarity = Math.max(maxSimilarity, nameSim);

    // Check against extracted names
    for (const extracted of extractedNames) {
      const sim = stringSimilarity(place.businessname, extracted);
      maxSimilarity = Math.max(maxSimilarity, sim);
    }

    // Location-based matching if post has location
    let locationScore = 0;
    if (post.location && place.latitude && place.longitude) {
      const distance = haversineDistance(
        post.location.lat, post.location.lng,
        place.latitude, place.longitude
      );
      if (distance < LOCATION_THRESHOLD_KM) {
        locationScore = 1 - (distance / LOCATION_THRESHOLD_KM);
      }
    }

    // Combined score
    const combinedScore = Math.max(maxSimilarity, locationScore * 0.8);

    if (combinedScore >= NAME_SIMILARITY_THRESHOLD) {
      matches.push({ place, score: combinedScore, isHiddenGem });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Reddit to Places Linker');
  console.log('='.repeat(60));

  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI must be set in .env');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('boston_database');
    const placesCollection = db.collection('boston_places');
    const redditCollection = db.collection('reddit_posts');

    // Check if reddit_posts collection exists
    const collections = await db.listCollections({ name: 'reddit_posts' }).toArray();
    if (collections.length === 0) {
      console.log('\nNote: reddit_posts collection does not exist.');
      console.log('Creating sample structure for future Reddit data...');

      // Create the collection with a sample document structure
      await db.createCollection('reddit_posts');
      console.log('Created reddit_posts collection');

      // Add indexes
      await redditCollection.createIndex({ id: 1 }, { unique: true });
      await redditCollection.createIndex({ subreddit: 1 });
      await redditCollection.createIndex({ created_utc: -1 });
      console.log('Created indexes on reddit_posts');

      console.log('\nTo populate Reddit data, you can:');
      console.log('1. Use the Reddit API to fetch posts from r/boston, r/bostonfoodies');
      console.log('2. Import existing Reddit data dumps');
      console.log('3. Use a Reddit scraper with proper rate limiting');

      return;
    }

    // Load all places
    const places = await placesCollection.find({}).toArray() as unknown as Place[];
    console.log(`\nLoaded ${places.length} places`);

    // Load Reddit posts (filter for Boston-related subreddits)
    const redditPosts = await redditCollection.find({
      subreddit: { $in: ['boston', 'bostonfoodies', 'BostonEats', 'massachusetts'] }
    }).toArray() as unknown as RedditPost[];

    console.log(`Found ${redditPosts.length} Reddit posts to process`);

    if (redditPosts.length === 0) {
      console.log('No Reddit posts to process');
      return;
    }

    // Process each post and link to places
    let linkedCount = 0;
    let hiddenGemCount = 0;

    for (const post of redditPosts) {
      const matches = findMatchingPlaces(post, places);

      for (const match of matches.slice(0, 3)) { // Top 3 matches per post
        const fullText = `${post.title} ${post.selftext || ''}`;
        const sentiment = estimateSentiment(fullText);

        const mention: RedditMention = {
          postId: post.id,
          subreddit: post.subreddit,
          title: post.title,
          sentiment,
          score: post.score,
          date: new Date(post.created_utc * 1000).toISOString(),
          permalink: `https://reddit.com${post.permalink}`
        };

        // Update the place with Reddit mention
        await placesCollection.updateOne(
          { _id: match.place._id },
          {
            $push: { reddit_mentions: mention } as any,
            $set: {
              isHiddenGem: match.isHiddenGem || undefined,
              trendingScore: post.score > 100 ? Math.min(10, post.score / 50) : undefined
            }
          }
        );

        linkedCount++;
        if (match.isHiddenGem) hiddenGemCount++;

        process.stdout.write('.');
      }
    }

    console.log('\n');
    console.log('='.repeat(60));
    console.log('COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total links created: ${linkedCount}`);
    console.log(`Hidden gems identified: ${hiddenGemCount}`);

    // Calculate aggregate stats
    const placesWithMentions = await placesCollection.countDocuments({
      reddit_mentions: { $exists: true, $ne: [] }
    });
    console.log(`Places with Reddit mentions: ${placesWithMentions}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

main();
