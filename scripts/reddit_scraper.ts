/**
 * Boston Itinerary Scraper v3.0 - Semantic Search & RAG Engine
 * Saves to MongoDB for WPI Parent Weekend
 * Supports vector-based semantic search for hidden spots and posts
 */
import { MongoClient, Collection } from "mongodb";
import { config } from "dotenv";
import fs from "fs";
import readline from "readline";

import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

const BOSTON_DB_NAME = "boston_database";
const BOSTON_COLLECTION = "hidden_events";
// Ensure URI is defined, otherwise fallback will trigger
const MONGODB_URI = process.env.MONGODB_URI || "";
const USER_AGENT = "BostonScraper/1.0 (Hackathon Project; contact: boston_team)";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

let client: MongoClient | null = null;
let useLocalFallback = false;
const localData: any[] = [];

// =====================================================
// DATABASE FUNCTIONS
// =====================================================

async function connectDB(): Promise<Collection | null> {
    if (!MONGODB_URI) {
        console.warn("MONGODB_URI not set. Falling back to local JSON file.");
        useLocalFallback = true;
        return null;
    }

    console.log(`Connecting to MongoDB...`);
    client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
    });

    try {
        await client.connect();
        console.log(`✓ Connected to MongoDB\n`);
        return client.db(BOSTON_DB_NAME).collection(BOSTON_COLLECTION);
    } catch (err) {
        console.error("MongoDB Connection Failed (likely a firewall block).");
        console.log(">>> FALLING BACK TO LOCAL FILE: reddit_events.json\n");
        useLocalFallback = true;
        return null;
    }
}

async function saveData(collection: Collection | null, doc: any) {
    if (useLocalFallback) {
        localData.push(doc);
        fs.writeFileSync('reddit_events.json', JSON.stringify(localData, null, 2));
        return;
    }

    if (collection) {
        try {
            await collection.updateOne(
                { id: doc.id },
                { $set: doc },
                { upsert: true }
            );
        } catch (e) {
            console.error(`Failed to save to Mongo:`, e);
        }
    }
}

// =====================================================
// RATE LIMITING & NETWORK
// =====================================================

let lastRequestTime = 0;
// Increased rate limit to 2s to be more polite and avoid 429s
async function rateLimitedDelay() {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < 2000) await new Promise(r => setTimeout(r, 2000 - elapsed));
    lastRequestTime = Date.now();
}

// =====================================================
// KEYWORDS & CLASSIFICATION
// =====================================================

const KEYWORDS: Record<string, string[]> = {
    food: ['restaurant', 'food', 'eat', 'lobster', 'pizza', 'bar', 'cafe', 'brunch', 'italian', 'seafood'],
    events: ['event', 'festival', 'concert', 'show', 'weekend', 'tonight', 'happening', 'free', 'party', 'performance', 'exhibit', 'gallery', 'market', 'live music', 'gig', 'tickets'],
    transit: ['mbta', 'commuter rail', 'train', 'bus', 'worcester line', 'red line', 'green line', 'south station'],
    attractions: ['museum', 'park', 'tour', 'walk', 'view', 'historic', 'fenway', 'harbor', 'freedom trail'],
    parentFriendly: ['quiet', 'seating', 'reservation', 'scenic', 'family', 'parent', 'nice', 'classy', 'accessible'],
    hiddenGems: ['hidden gem', 'underrated', 'locals', 'secret', 'best kept', 'instead of', 'better than', 'hole in the wall', 'off the beaten path', 'local favorite', 'nobody knows'],
    hiddenEvents: ['pop-up', 'speakeasy', 'underground', 'alternative', 'indie', 'local favorite', 'DIY', 'house show', 'niche', 'experimental', 'secret show', 'invite only'],
    touristTraps: ['overrated', 'tourist trap', 'avoid', 'crowded', 'expensive', 'skip', 'faneuil', 'quincy market'],
    wpiLogistics: ['parent', 'commuter rail', 'worcester', 'framingham', 'union station', 'boston trip', 'wpi'],
    nightlife: ['bar', 'club', 'pub', 'brewery', 'cocktail', 'dive bar', 'speakeasy', 'rooftop', 'late night'],
    culture: ['gallery', 'art', 'museum', 'theater', 'performance', 'music venue', 'jazz', 'blues', 'classical']
};

const NEGATIVE_KEYWORDS = ['crime', 'police', 'arrest', 'shooting', 'accident', 'traffic', 'housing', 'rent', 'politics', 'election', 'mayor', 'protest', 'strike', 'legal', 'warning', 'ice surge', 'arrested', 'homeless', 'migrant', 'crisis', 'budget', 'city council', 'legislation', 'Elon', 'Tesla', 'Trump', 'Biden', 'Senator', 'Governor'];

const TOURIST_TRAPS = ['faneuil hall', 'quincy market', 'cheers', "mike's pastry", 'union oyster house', 'legal sea foods', 'starbucks'];
const BOSTON_PLACES = ['fenway', 'back bay', 'beacon hill', 'north end', 'south end', 'seaport', 'cambridge',
    'somerville', 'brookline', 'downtown', 'chinatown', 'south boston', 'charlestown', 'harvard square',
    'newbury street', 'copley', 'prudential', 'boston common', 'worcester', 'framingham', 'south station',
    'allston', 'jamaica plain', 'roxbury', 'dorchester', 'medford', 'malden', 'quincy'];

const SUBREDDITS = [
    // Main Boston subs
    'boston',
    'BostonHappenings',
    'BostonSocialClub',
    'BostonFood',
    'boston_events',
    'visitboston',
    // Neighborhoods
    'somerville',
    'CambridgeMA',
    'Brookline',
    'Allston',
    'JamaicaPlain',
    'Malden',
    'Medford',
    // Activities
    'bostonmusic',
    'bostoncomedy',
    'BostonBruins',
    'BostonCeltics',
    'redsox',
    'NEPatriots',
    // College/Young Adult
    'WPI',
    'NEU',
    'BostonU',
    'mit',
    'harvard',
    // Lifestyle
    'bostondining',
    'BostonDrinks',
    'bostonr4r'
];

// =====================================================
// EMBEDDING & VECTOR SEARCH
// =====================================================

async function getEmbedding(text: string): Promise<number[]> {
    if (!GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY not set, skipping embeddings");
        return [];
    }
    try {
        const response = await fetch(EMBEDDING_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text: text.substring(0, 8000) }] }
            })
        });
        const data = await response.json();
        return data.embedding?.values || [];
    } catch (error) {
        console.error('Embedding error:', error);
        return [];
    }
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface SearchResult {
    post: any;
    score: number;
}

/**
 * Semantic search through Reddit posts using vector similarity
 * - Finds posts most semantically similar to the query
 * - Uses cosine similarity on embeddings
 */
async function semanticSearch(
    query: string,
    posts: any[],
    topK: number = 10,
    minScore: number = 0.3
): Promise<SearchResult[]> {
    console.log(`\n🔍 Generating embedding for query: "${query}"...`);
    const queryEmbedding = await getEmbedding(query);

    if (!queryEmbedding.length) {
        console.error("Failed to generate query embedding");
        return [];
    }

    const results: SearchResult[] = [];

    for (const post of posts) {
        if (!post.embedding || !post.embedding.length) continue;

        const score = cosineSimilarity(queryEmbedding, post.embedding);
        if (score >= minScore) {
            results.push({ post, score });
        }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
}

/**
 * Hybrid search: combines semantic similarity with keyword matching
 */
async function hybridSearch(
    query: string,
    posts: any[],
    topK: number = 10
): Promise<SearchResult[]> {
    // Get semantic results
    const semanticResults = await semanticSearch(query, posts, topK * 2, 0.25);

    // Keyword boost
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const boostedResults = semanticResults.map(result => {
        let boost = 0;
        const postText = `${result.post.title} ${result.post.text} ${result.post.context}`.toLowerCase();

        // Boost for exact keyword matches
        for (const word of queryWords) {
            if (postText.includes(word)) boost += 0.05;
        }

        // Boost for hidden gems/spots
        if (queryLower.includes('hidden') || queryLower.includes('secret') || queryLower.includes('underrated')) {
            if (result.post.categories?.includes('hiddenGems') || result.post.categories?.includes('hiddenEvents')) {
                boost += 0.15;
            }
        }

        // Boost for specific locations
        for (const place of BOSTON_PLACES) {
            if (queryLower.includes(place) && postText.includes(place)) {
                boost += 0.1;
                break;
            }
        }

        // Boost high engagement posts slightly
        if (result.post.ups > 100) boost += 0.02;
        if (result.post.num_comments > 50) boost += 0.02;

        return {
            ...result,
            score: Math.min(result.score + boost, 1.0)
        };
    });

    boostedResults.sort((a, b) => b.score - a.score);
    return boostedResults.slice(0, topK);
}

// =====================================================
// RAG: ANSWER GENERATION WITH RETRIEVED CONTEXT
// =====================================================

/**
 * Generate a comprehensive answer using retrieved posts as context
 * Uses Gemini to synthesize information from multiple sources
 */
async function generateAnswer(
    query: string,
    retrievedPosts: SearchResult[]
): Promise<string> {
    if (!GEMINI_API_KEY) {
        return formatSimpleAnswer(retrievedPosts);
    }

    // Build context from retrieved posts
    const context = retrievedPosts.map((r, i) => {
        const post = r.post;
        return `[Source ${i + 1} - Score: ${(r.score * 100).toFixed(1)}%]
Title: ${post.title}
Subreddit: r/${post.subreddit}
Upvotes: ${post.ups} | Comments: ${post.num_comments}
Categories: ${post.categories?.join(', ') || 'N/A'}
Locations: ${post.locations?.join(', ') || 'N/A'}
Content: ${post.context || post.text?.substring(0, 500) || 'No content'}
URL: ${post.url}
---`;
    }).join('\n\n');

    const prompt = `You are a helpful Boston local guide assistant. A user is asking about hidden spots, local recommendations, or events in the Boston area.

User Query: "${query}"

Here are relevant Reddit posts and discussions that may help answer the query:

${context}

Based on these sources, provide a comprehensive, helpful answer that:
1. Directly addresses the user's query
2. Synthesizes information from multiple sources when relevant
3. Includes specific place names, neighborhoods, and recommendations
4. Mentions if something is a "hidden gem" vs tourist-friendly
5. Provides practical tips (best times to go, what to order, etc.)
6. Cites the sources by mentioning "according to r/[subreddit]" or "locals recommend"
7. If the sources don't fully answer the question, acknowledge limitations

Keep your response conversational but informative. Use bullet points for lists of recommendations.`;

    try {
        const response = await fetch(GEMINI_GENERATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1500,
                    topP: 0.9
                }
            })
        });

        if (!response.ok) {
            console.error('Gemini API error:', response.status);
            return formatSimpleAnswer(retrievedPosts);
        }

        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!answer) {
            return formatSimpleAnswer(retrievedPosts);
        }

        // Append source links
        const sources = retrievedPosts.slice(0, 5).map(r =>
            `• [${r.post.title.substring(0, 60)}...](${r.post.url})`
        ).join('\n');

        return `${answer}\n\n---\n📚 **Sources:**\n${sources}`;
    } catch (error) {
        console.error('Answer generation error:', error);
        return formatSimpleAnswer(retrievedPosts);
    }
}

function formatSimpleAnswer(results: SearchResult[]): string {
    if (!results.length) {
        return "I couldn't find any relevant posts matching your query. Try rephrasing or asking about specific neighborhoods/activities.";
    }

    let answer = "Based on local Reddit discussions, here are the most relevant findings:\n\n";

    for (const r of results.slice(0, 5)) {
        const post = r.post;
        answer += `**${post.title}**\n`;
        answer += `↳ r/${post.subreddit} | 👍 ${post.ups} | 💬 ${post.num_comments}\n`;
        if (post.locations?.length) {
            answer += `📍 ${post.locations.join(', ')}\n`;
        }
        if (post.text) {
            answer += `"${post.text.substring(0, 200)}..."\n`;
        }
        answer += `🔗 ${post.url}\n\n`;
    }

    return answer;
}

// =====================================================
// INTERACTIVE SEARCH CLI
// =====================================================

async function loadPostsFromSource(): Promise<any[]> {
    // Try MongoDB first
    if (MONGODB_URI) {
        try {
            const tempClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
            await tempClient.connect();
            const collection = tempClient.db(BOSTON_DB_NAME).collection(BOSTON_COLLECTION);
            const posts = await collection.find({}).toArray();
            await tempClient.close();
            console.log(`✓ Loaded ${posts.length} posts from MongoDB`);
            return posts;
        } catch {
            console.log("MongoDB not available, falling back to local file...");
        }
    }

    // Fallback to local JSON
    try {
        const data = fs.readFileSync('reddit_events.json', 'utf-8');
        const posts = JSON.parse(data);
        console.log(`✓ Loaded ${posts.length} posts from local file`);
        return posts;
    } catch {
        console.error("No data available. Run the scraper first.");
        return [];
    }
}

/**
 * Main search interface - ask questions about hidden spots
 */
export async function askAboutHiddenSpots(query: string): Promise<string> {
    console.log("\n" + "=".repeat(60));
    console.log("🔎 Boston Hidden Spots Search Engine");
    console.log("=".repeat(60));

    const posts = await loadPostsFromSource();

    if (!posts.length) {
        return "No posts available. Please run the scraper first.";
    }

    // Filter to posts with embeddings
    const postsWithEmbeddings = posts.filter(p => p.embedding?.length > 0);
    console.log(`📊 ${postsWithEmbeddings.length}/${posts.length} posts have embeddings`);

    if (!postsWithEmbeddings.length) {
        return "No posts with embeddings found. Re-run the scraper to generate embeddings.";
    }

    // Perform hybrid search
    console.log(`\n🔍 Searching for: "${query}"`);
    const results = await hybridSearch(query, postsWithEmbeddings, 8);

    console.log(`\n📊 Found ${results.length} relevant posts`);

    if (results.length) {
        console.log("\nTop matches:");
        results.slice(0, 5).forEach((r, i) => {
            console.log(`  ${i + 1}. [${(r.score * 100).toFixed(1)}%] ${r.post.title.substring(0, 60)}...`);
        });
    }

    // Generate comprehensive answer
    console.log("\n🤖 Generating answer...");
    const answer = await generateAnswer(query, results);

    return answer;
}

/**
 * Interactive CLI for searching
 */
async function runInteractiveSearch() {
    console.log("\n" + "=".repeat(60));
    console.log("🔎 Boston Hidden Spots Search Engine - Interactive Mode");
    console.log("=".repeat(60));
    console.log("Ask me anything about hidden spots, local recommendations,");
    console.log("events, restaurants, bars, and more in Boston!");
    console.log("Type 'exit' or 'quit' to stop.\n");

    const posts = await loadPostsFromSource();

    if (!posts.length) {
        console.log("No posts available. Please run the scraper first.");
        return;
    }

    const postsWithEmbeddings = posts.filter(p => p.embedding?.length > 0);
    console.log(`📊 ${postsWithEmbeddings.length}/${posts.length} posts have embeddings\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = () => {
        rl.question("\n🔍 Your question: ", async (query) => {
            if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
                console.log("\nGoodbye! 👋");
                rl.close();
                return;
            }

            if (!query.trim()) {
                askQuestion();
                return;
            }

            const results = await hybridSearch(query, postsWithEmbeddings, 8);

            console.log(`\n📊 Found ${results.length} relevant posts`);

            if (results.length) {
                console.log("\nTop matches:");
                results.slice(0, 3).forEach((r, i) => {
                    console.log(`  ${i + 1}. [${(r.score * 100).toFixed(1)}%] ${r.post.title.substring(0, 50)}...`);
                });
            }

            console.log("\n🤖 Generating answer...\n");
            console.log("-".repeat(50));
            const answer = await generateAnswer(query, results);
            console.log(answer);
            console.log("-".repeat(50));

            askQuestion();
        });
    };

    askQuestion();
}

// =====================================================
// REDDIT SCRAPING FUNCTIONS
// =====================================================

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
    const positive = ['amazing', 'best', 'love', 'great', 'awesome', 'recommend', 'gem', 'favorite', 'excellent', 'incredible', 'fantastic'];
    const negative = ['avoid', 'terrible', 'worst', 'overrated', 'disappointing', 'skip', 'crowded', 'expensive', 'awful', 'horrible'];
    let pos = 0, neg = 0;
    positive.forEach(w => { if (lower.includes(w)) pos++; });
    negative.forEach(w => { if (lower.includes(w)) neg++; });
    return { label: pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral', score: pos - neg };
}

function isTemporallyRelevant(post: any): boolean {
    const ageInDays = (Date.now() / 1000 - post.created_utc) / 86400;
    if (post.stickied) return true;
    if (post.link_flair_text?.toLowerCase().includes('guide')) return true;
    return ageInDays <= 365; // Extended to 1 year for more data
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
        const regex = new RegExp(`\\b(${words.join('|')})\\b`, 'i');
        if (regex.test(text)) categories.push(cat);
    });
    return categories;
}

function isEventLike(post: any, categories: string[]): boolean {
    const fullText = `${post.title} ${post.selftext}`.toLowerCase();
    const flair = (post.link_flair_text || "").toLowerCase();

    // Event-related flairs
    const eventFlairs = ['event', 'happening', 'music', 'food', 'festival', 'guide', 'classified', 'recommendation'];
    if (eventFlairs.some(f => flair.includes(f))) return true;

    // Allow more categories for better coverage
    const relevantCategories = ['events', 'hiddenEvents', 'attractions', 'food', 'hiddenGems', 'nightlife', 'culture'];
    const hasRelevantCategory = categories.some(cat => relevantCategories.includes(cat));

    // Filter out negative keywords
    const expandedNegative = [...NEGATIVE_KEYWORDS, 'ice', 'immigration', 'government', 'boston council', 'budget', 'shelter', 'migrant', 'crisis'];
    const negativeRegex = new RegExp(`\\b(${expandedNegative.join('|')})\\b`, 'i');

    if (negativeRegex.test(fullText)) return false;

    return hasRelevantCategory;
}

function getParentFriendlyScore(text: string): number {
    const lower = text.toLowerCase();
    const indicators = ['quiet', 'seating', 'reservation', 'scenic', 'accessible', 'comfortable', 'relaxed', 'upscale', 'elegant', 'refined'];
    return indicators.filter(i => lower.includes(i)).length;
}

function calculateRelevance(post: any, categories: string[], entities: any, parentScore: number): number {
    let score = Math.min(post.ups / 10, 30) + Math.min(post.num_comments / 5, 15);
    const age = (Date.now() / 1000 - post.created_utc) / 86400;
    if (age < 3) score += 25; else if (age < 7) score += 15; else if (age < 14) score += 10;
    if (post.stickied) score += 20;
    if (categories.includes('parentFriendly')) score += 15;
    if (categories.includes('hiddenGems')) score += 25;
    if (categories.includes('hiddenEvents')) score += 25;
    if (categories.includes('food')) score += 10;
    if (categories.includes('nightlife')) score += 10;
    if (entities.touristTraps.length > 0) score -= 10;
    score += parentScore * 3;
    return Math.round(score);
}

function generateAIContext(post: any, comments: any[]): string {
    let ctx = `Title: ${post.title}\n`;
    if (post.selftext) ctx += `Post: ${post.selftext.substring(0, 800)}\n`;
    const tops = comments.sort((a, b) => b.upvotes - a.upvotes).slice(0, 8).map(c => c.body.substring(0, 300));
    if (tops.length) ctx += `Comments: ${tops.join(' | ')}`;
    return ctx.substring(0, 2000);
}

async function fetchComments(permalink: string): Promise<any[]> {
    try {
        const data = await fetchReddit(`${permalink}.json?limit=50&depth=1&raw_json=1`);
        const raw = data[1]?.data?.children || [];
        return raw.filter((c: any) => c.kind === 't1' && c.data?.body).slice(0, 30).map((c: any) => ({
            id: c.data.id, body: c.data.body.substring(0, 600), upvotes: c.data.ups,
            sentiment: analyzeSentiment(c.data.body).label, entities: extractEntities(c.data.body)
        }));
    } catch { return []; }
}

// =====================================================
// MAIN SCRAPER
// =====================================================

async function runScraper() {
    const collection = await connectDB();
    console.log(`Starting scraper for ${SUBREDDITS.length} subreddits...`);

    let savedCount = 0;
    const processedThisRun = new Set<string>();

    // Pre-fetch all IDs in the database to avoid redundant scraping
    const existingIds = new Set<string>();
    if (collection) {
        try {
            const docs = await collection.find({}, { projection: { id: 1 } }).toArray();
            docs.forEach(doc => existingIds.add(doc.id));
            console.log(`✓ Cached ${existingIds.size} existing IDs from database.`);
        } catch (e) {
            console.error("Failed to fetch existing IDs:", e);
        }
    }

    for (const sub of SUBREDDITS) {
        console.log(`\nScraping r/${sub}...`);
        // Fetch more posts per subreddit for better coverage
        const paths = [
            `/r/${sub}/top.json?t=year&limit=100`,  // Top posts from past year
            `/r/${sub}/top.json?t=month&limit=100`, // Top posts from past month
            `/r/${sub}/new.json?limit=50`,           // Recent posts
            `/r/${sub}/hot.json?limit=50`            // Hot posts
        ];

        for (const path of paths) {
            const data = await fetchReddit(path);
            const posts = data.data?.children || [];

            for (const { data: post } of posts) {
                // Skip if already processed in this RUN or exists in DB
                if (processedThisRun.has(post.name) || existingIds.has(post.name)) continue;

                if (!isTemporallyRelevant(post)) continue;

                const categories = categorizePost(post.title, post.selftext);

                // More permissive filtering for hidden spots
                if (!isEventLike(post, categories)) continue;

                const entities = extractEntities(`${post.title} ${post.selftext}`);
                const parentScore = getParentFriendlyScore(`${post.title} ${post.selftext}`);
                const relevance = calculateRelevance(post, categories, entities, parentScore);

                // Lower threshold, prioritize hidden content
                if (relevance < 10 && !categories.includes('hiddenEvents') && !categories.includes('hiddenGems')) continue;

                console.log(`  - Processing: ${post.title.substring(0, 50)}...`);
                const comments = await fetchComments(post.permalink);
                const context = generateAIContext(post, comments);

                const embedding = await getEmbedding(context);

                const doc = {
                    id: post.name,
                    title: post.title,
                    text: post.selftext,
                    url: `https://reddit.com${post.permalink}`,
                    subreddit: sub,
                    ups: post.ups,
                    num_comments: post.num_comments,
                    created_at: new Date(post.created_utc * 1000).toISOString(),
                    categories,
                    locations: entities.locations,
                    touristTraps: entities.touristTraps,
                    relevanceScore: relevance,
                    sentiment: analyzeSentiment(post.title).label,
                    isHiddenGem: categories.includes('hiddenGems') || categories.includes('hiddenEvents'),
                    embedding,
                    context: context.substring(0, 1500),
                    scraped_at: new Date().toISOString()
                };

                await saveData(collection, doc);
                processedThisRun.add(post.name);
                savedCount++;
            }
        }
    }

    if (client) await client.close();

    if (useLocalFallback) {
        console.log(`\nScraping complete! ${savedCount} items saved to local file.`);
        console.log(">>> Attempting FINAL SYNC to MongoDB collection: hidden_events...");

        const syncClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
        try {
            await syncClient.connect();
            const col = syncClient.db(BOSTON_DB_NAME).collection(BOSTON_COLLECTION);
            console.log("✓ Connected! Uploading data...");

            for (const doc of localData) {
                await col.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
            }

            console.log(`✓ SUCCESS! Synced ${localData.length} events to MongoDB.`);
            await syncClient.close();
        } catch (e) {
            console.log("\n✗ Final sync failed. Your data is SAFE in 'reddit_events.json'.");
            console.log("To upload later, run the scraper again when you have a better connection.");
        }
    } else {
        console.log(`\n✓ Scraper finished! Saved ${savedCount} posts directly to MongoDB.`);
    }
}

// =====================================================
// CLI ENTRY POINT
// =====================================================

const args = process.argv.slice(2);

if (args[0] === 'search') {
    // Search mode: npx ts-node scraper.ts search "your query"
    const query = args.slice(1).join(' ');
    if (query) {
        askAboutHiddenSpots(query).then(answer => {
            console.log("\n" + "=".repeat(60));
            console.log("📝 ANSWER:");
            console.log("=".repeat(60));
            console.log(answer);
        });
    } else {
        // Interactive mode
        runInteractiveSearch();
    }
} else if (args[0] === 'interactive') {
    runInteractiveSearch();
} else {
    // Default: run scraper
    runScraper().catch(console.error);
}

// Export for use as a module
export { semanticSearch, hybridSearch, generateAnswer, loadPostsFromSource };
