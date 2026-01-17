/**
 * Boston Itinerary Scraper v2.0 - Sentiment-Aware Engine
 * Saves to MongoDB for WPI Parent Weekend
 */
import { MongoClient, Collection } from "mongodb";
import { config } from "dotenv";

config();

const BOSTON_DB_NAME = "BOSTON_ITINERARY";
const BOSTON_COLLECTION = "reddit_posts";
const MONGODB_URI = process.env.MONGODB_URI || "";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

let client: MongoClient | null = null;

async function connectDB(): Promise<Collection> {
  if (!MONGODB_URI) throw new Error("MONGODB_URI not set in .env");
  console.log(`Connecting to ${BOSTON_DB_NAME}...`);
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(BOSTON_DB_NAME);
  const collection = db.collection(BOSTON_COLLECTION);
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ subreddit: 1, relevanceScore: -1 });
  await collection.createIndex({ categories: 1 });
  console.log(`Connected\n`);
  return collection;
}

async function closeDB() {
  if (client) await client.close();
}

let lastRequestTime = 0;
async function rateLimitedDelay() {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < 3000) await new Promise(r => setTimeout(r, 3000 - elapsed));
  lastRequestTime = Date.now();
}

const KEYWORDS: Record<string, string[]> = {
  food: ['restaurant', 'food', 'eat', 'lobster', 'pizza', 'bar', 'cafe', 'brunch', 'italian', 'seafood'],
  events: ['event', 'festival', 'concert', 'show', 'weekend', 'tonight', 'happening', 'free'],
  transit: ['mbta', 'commuter rail', 'train', 'bus', 'worcester line', 'red line', 'green line', 'south station'],
  attractions: ['museum', 'park', 'tour', 'walk', 'view', 'historic', 'fenway', 'harbor', 'freedom trail'],
  parentFriendly: ['quiet', 'seating', 'reservation', 'scenic', 'family', 'parent', 'nice', 'classy', 'accessible'],
  hiddenGems: ['hidden gem', 'underrated', 'locals', 'secret', 'best kept', 'instead of', 'better than'],
  touristTraps: ['overrated', 'tourist trap', 'avoid', 'crowded', 'expensive', 'skip', 'faneuil', 'quincy market'],
  wpiLogistics: ['parent', 'commuter rail', 'worcester', 'framingham', 'union station', 'boston trip', 'wpi']
};

const TOURIST_TRAPS = ['faneuil hall', 'quincy market', 'cheers', "mike's pastry"];
const BOSTON_PLACES = ['fenway', 'back bay', 'beacon hill', 'north end', 'south end', 'seaport', 'cambridge', 
  'somerville', 'brookline', 'downtown', 'chinatown', 'south boston', 'charlestown', 'harvard square', 
  'newbury street', 'copley', 'prudential', 'boston common', 'worcester', 'framingham', 'south station'];
const SUBREDDITS = ['boston', 'WPI', 'BostonHappenings', 'BostonSocialClub', 'BostonFood'];

async function fetchReddit(path: string, retries = 2): Promise<any> {
  await rateLimitedDelay();
  try {
    const res = await fetch(`https://www.reddit.com${path}`, {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" }
    });
    if (res.status === 429 && retries > 0) {
      console.log(`Rate limited, waiting 30s...`);
      await new Promise(r => setTimeout(r, 30000));
      return fetchReddit(path, retries - 1);
    }
    if (!res.ok) return { data: { children: [] } };
    return await res.json();
  } catch { return { data: { children: [] } }; }
}

function analyzeSentiment(text: string): { label: string; score: number } {
  const lower = text.toLowerCase();
  const positive = ['amazing', 'best', 'love', 'great', 'awesome', 'recommend', 'gem', 'favorite', 'excellent'];
  const negative = ['avoid', 'terrible', 'worst', 'overrated', 'disappointing', 'skip', 'crowded', 'expensive'];
  let pos = 0, neg = 0;
  positive.forEach(w => { if (lower.includes(w)) pos++; });
  negative.forEach(w => { if (lower.includes(w)) neg++; });
  return { label: pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral', score: pos - neg };
}

function isTemporallyRelevant(post: any): boolean {
  const ageInDays = (Date.now() / 1000 - post.created_utc) / 86400;
  if (post.stickied) return true;
  if (post.link_flair_text?.toLowerCase().includes('guide')) return true;
  return ageInDays <= 30;
}

function extractEntities(text: string) {
  const lower = text.toLowerCase();
  const locations: string[] = [], touristTraps: string[] = [];
  BOSTON_PLACES.forEach(p => { if (lower.includes(p)) locations.push(p); });
  TOURIST_TRAPS.forEach(t => { if (lower.includes(t)) touristTraps.push(t); });
  return { locations: [...new Set(locations)], touristTraps: [...new Set(touristTraps)] };
}

function categorizePost(title: string, selftext: string): string[] {
  const text = `${title} ${selftext}`.toLowerCase();
  const categories: string[] = [];
  Object.entries(KEYWORDS).forEach(([cat, words]) => {
    if (words.some(w => text.includes(w))) categories.push(cat);
  });
  return categories.length > 0 ? categories : ['general'];
}

function getParentFriendlyScore(text: string): number {
  const lower = text.toLowerCase();
  const indicators = ['quiet', 'seating', 'reservation', 'scenic', 'accessible', 'comfortable', 'relaxed', 'upscale'];
  return indicators.filter(i => lower.includes(i)).length;
}

function calculateRelevance(post: any, categories: string[], entities: any, parentScore: number): number {
  let score = Math.min(post.ups / 10, 30) + Math.min(post.num_comments / 5, 15);
  const age = (Date.now() / 1000 - post.created_utc) / 86400;
  if (age < 3) score += 25; else if (age < 7) score += 15; else if (age < 14) score += 10;
  if (post.stickied) score += 20;
  if (categories.includes('parentFriendly')) score += 15;
  if (categories.includes('hiddenGems')) score += 20;
  if (categories.includes('food')) score += 10;
  if (entities.touristTraps.length > 0) score -= 10;
  score += parentScore * 3;
  return Math.round(score);
}

function generateAIContext(post: any, comments: any[]): string {
  let ctx = `Title: ${post.title}\n`;
  if (post.selftext) ctx += `Post: ${post.selftext.substring(0, 500)}\n`;
  const tops = comments.sort((a, b) => b.upvotes - a.upvotes).slice(0, 5).map(c => c.body.substring(0, 200));
  if (tops.length) ctx += `Comments: ${tops.join(' | ')}`;
  return ctx.substring(0, 1500);
}

async function fetchComments(permalink: string): Promise<any[]> {
  try {
    const data = await fetchReddit(`${permalink}.json?limit=25&depth=1&raw_json=1`);
    const raw = data[1]?.data?.children || [];
    return raw.filter((c: any) => c.kind === 't1' && c.data?.body).slice(0, 20).map((c: any) => ({
      id: c.data.id, body: c.data.body.substring(0, 500), upvotes: c.data.ups,
      sentiment: analyzeSentiment(c.data.body).label, entities: extractEntities(c.data.body)
    }));
  } catch { return []; }
}
