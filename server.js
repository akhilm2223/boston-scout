import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

let db;
let placesCollection;
let eventsCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✓ Connected to MongoDB');

    db = client.db('boston_database');
    placesCollection = db.collection('boston_places');
    eventsCollection = db.collection('boston_events');
    const landmarksCollection = db.collection('boston_landmarks');

    const placeCount = await placesCollection.countDocuments();
    const eventCount = await eventsCollection.countDocuments();
    console.log(`✓ Found ${placeCount} places`);
    console.log(`✓ Found ${eventCount} events`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// API Routes

// Get all places
app.get('/api/places', async (req, res) => {
  try {
    const places = await placesCollection
      .find({})
      .project({
        businessname: 1,
        address: 1,
        city: 1,
        latitude: 1,
        longitude: 1,
        rating: 1,
        user_rating_count: 1,
        categories: 1,
        price_level: 1,
        phone: 1,
        website: 1,
        google_maps_url: 1,
        photo_name: 1,
        dine_in: 1,
        takeout: 1,
        delivery: 1,
        reservable: 1,
        serves_breakfast: 1,
        serves_lunch: 1,
        serves_dinner: 1,
        serves_brunch: 1,
        outdoor_seating: 1,
        good_for_groups: 1,
      })
      .toArray();

    res.json(places);
  } catch (error) {
    console.error('Error fetching places:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

app.get('/api/landmarks', async (req, res) => {
  try {
    const landmarksCollection = db.collection('boston_landmarks');
    const landmarks = await landmarksCollection
      .find({})
      .project({
        embedding: 0
      })
      .toArray();

    console.log(`[Landmarks] Loaded ${landmarks.length} landmarks from boston_landmarks collection`);
    res.json(landmarks);
  } catch (error) {
    console.error('Error fetching landmarks:', error);
    res.status(500).json({ error: 'Failed to fetch landmarks' });
  }
});

// Get hotels (optimized for fast loading)
app.get('/api/hotels', async (req, res) => {
  try {
    const hotelsCollection = db.collection('boston-hotels');
    const hotels = await hotelsCollection
      .find({})
      .project({
        name: 1,
        address: 1,
        lat: 1,
        lng: 1,
        rating: 1,
        user_rating_count: 1,
        price_level: 1,
        photo_name: 1
      })
      .sort({ rating: -1, user_rating_count: -1 })
      .limit(50)
      .toArray();

    console.log(`[Hotels] Loaded ${hotels.length} hotels from boston-hotels collection`);

    // Map fields for frontend compatibility
    const formattedHotels = hotels.map(h => ({
      ...h,
      location: { lat: h.lat, lng: h.lng }
    }));

    res.json(formattedHotels);
  } catch (error) {
    console.error('Error fetching hotels:', error);
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// Get places by filter
app.get('/api/places/filter', async (req, res) => {
  try {
    const { minRating, priceLevel, category, features } = req.query;

    const query = {};

    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    if (priceLevel) {
      query.price_level = parseInt(priceLevel);
    }

    if (category) {
      query.categories = { $regex: category, $options: 'i' };
    }

    // Feature filters
    if (features) {
      const featureList = features.split(',');
      featureList.forEach(feature => {
        query[feature] = true;
      });
    }

    const places = await placesCollection.find(query).toArray();
    res.json(places);
  } catch (error) {
    console.error('Error filtering places:', error);
    res.status(500).json({ error: 'Failed to filter places' });
  }
});

// Get place by ID
app.get('/api/places/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // Validate ObjectId format (24 hex characters)
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid place ID format' });
    }

    const { ObjectId } = await import('mongodb');
    const place = await placesCollection.findOne({
      _id: new ObjectId(id)
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    res.json(place);
  } catch (error) {
    console.error('Error fetching place:', error);
    res.status(500).json({ error: 'Failed to fetch place' });
  }
});

// Get all events
app.get('/api/events', async (req, res) => {
  try {
    const events = await eventsCollection
      .find({})
      .toArray();

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get events by date range
app.get('/api/events/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.start_time = {};
      if (startDate) query.start_time.$gte = startDate;
      if (endDate) query.start_time.$lte = endDate;
    }

    const events = await eventsCollection.find(query).toArray();
    res.json(events);
  } catch (error) {
    console.error('Error filtering events:', error);
    res.status(500).json({ error: 'Failed to filter events' });
  }
});

// AI-powered event search using Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Event categories available in the database
const EVENT_CATEGORIES = [
  'music', 'concert', 'live music',
  'sports', 'game', 'athletics',
  'arts', 'theater', 'museum', 'gallery', 'exhibition',
  'food', 'dining', 'festival', 'tastings',
  'comedy', 'standup',
  'nightlife', 'club', 'party',
  'family', 'kids', 'children',
  'outdoor', 'nature', 'parks',
  'tech', 'conference', 'workshop', 'networking',
  'community', 'social', 'meetup',
  'holiday', 'seasonal', 'celebration',
  'education', 'class', 'lecture',
  'wellness', 'fitness', 'yoga', 'health'
];

// Classify search query using Gemini
async function classifyEventQuery(userQuery) {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not set, using keyword extraction');
    return extractKeywords(userQuery);
  }

  try {
    const prompt = `You are an event search classifier. Extract ONLY the most relevant keywords from the user's query.

IMPORTANT: Be precise. Only include words that should appear in event titles.

User query: "${userQuery}"

Respond ONLY in this JSON format (no markdown, no code blocks):
{
  "keywords": ["exact", "words", "to", "search"],
  "dateHint": "today" | "tomorrow" | "this weekend" | "this week" | "next week" | null
}

Rules:
1. Extract the MAIN topic words only (e.g., "jazz", "music", "comedy", "food")
2. Ignore filler words like "show me", "find", "looking for", "events", "activities"
3. If user says "tonight" or "today", set dateHint to "today"
4. If user says "tomorrow", set dateHint to "tomorrow"
5. If user says "this weekend" or "saturday/sunday", set dateHint to "this weekend"

Examples:
- "jazz music tonight" -> {"keywords": ["jazz", "music"], "dateHint": "today"}
- "show me comedy shows" -> {"keywords": ["comedy"], "dateHint": null}
- "food festivals this weekend" -> {"keywords": ["food", "festival"], "dateHint": "this weekend"}
- "family activities" -> {"keywords": ["family"], "dateHint": null}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return extractKeywords(userQuery);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(jsonStr);
    console.log('Gemini classification:', parsed);
    return parsed;
  } catch (error) {
    console.error('Gemini classification error:', error);
    return extractKeywords(userQuery);
  }
}

// Fallback keyword extraction
function extractKeywords(query) {
  const words = query.toLowerCase().split(/\s+/);
  const matchedCategories = EVENT_CATEGORIES.filter(cat =>
    words.some(word => cat.includes(word) || word.includes(cat))
  );

  let dateHint = null;
  if (query.includes('today')) dateHint = 'today';
  else if (query.includes('tomorrow')) dateHint = 'tomorrow';
  else if (query.includes('weekend')) dateHint = 'this weekend';
  else if (query.includes('week')) dateHint = 'this week';

  return {
    categories: matchedCategories.length > 0 ? matchedCategories : [],
    dateHint,
    keywords: words.filter(w => w.length > 2 && !EVENT_CATEGORIES.includes(w))
  };
}

// Convert date hint to date range
function getDateRange(dateHint) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (dateHint) {
    case 'today':
      return {
        start: today.toISOString(),
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
      };
    case 'tomorrow':
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      return {
        start: tomorrow.toISOString(),
        end: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString()
      };
    case 'this weekend':
      const dayOfWeek = today.getDay();
      const daysToSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      const saturday = new Date(today.getTime() + daysToSaturday * 24 * 60 * 60 * 1000);
      const monday = new Date(saturday.getTime() + 2 * 24 * 60 * 60 * 1000);
      return { start: saturday.toISOString(), end: monday.toISOString() };
    case 'this week':
      const endOfWeek = new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000);
      return { start: today.toISOString(), end: endOfWeek.toISOString() };
    case 'next week':
      const startNextWeek = new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000);
      const endNextWeek = new Date(startNextWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { start: startNextWeek.toISOString(), end: endNextWeek.toISOString() };
    default:
      return null;
  }
}

// AI-powered event search endpoint
app.post('/api/events/search', async (req, res) => {
  try {
    const { query, startDate, endDate } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Classify the query using Gemini
    const classification = await classifyEventQuery(query);

    // Build MongoDB query
    const mongoQuery = {};

    // Build search query - prioritize keywords for precise matching
    const searchTerms = classification.keywords || [];

    if (searchTerms.length > 0) {
      // Use word boundary regex for more accurate matching
      // Match if ANY keyword appears in title (primary) or categories
      const regexPatterns = searchTerms.map(term => `\\b${term}\\b`).join('|');

      mongoQuery.$or = [
        { title: { $regex: regexPatterns, $options: 'i' } },
        { categories: { $elemMatch: { $regex: regexPatterns, $options: 'i' } } }
      ];

      console.log('Search terms:', searchTerms);
      console.log('Regex pattern:', regexPatterns);
    }

    // Date filter
    let dateRange = null;
    if (startDate && endDate) {
      dateRange = { start: startDate, end: endDate };
    } else if (classification.dateHint) {
      dateRange = getDateRange(classification.dateHint);
    }

    if (dateRange) {
      mongoQuery.start_time = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };
    }

    console.log('Event search query:', JSON.stringify(mongoQuery, null, 2));

    // Execute query
    const events = await eventsCollection
      .find(mongoQuery)
      .sort({ start_time: 1 })
      .limit(50)
      .toArray();

    res.json({
      classification,
      dateRange,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('Error in AI event search:', error);
    res.status(500).json({ error: 'Failed to search events' });
  }
});

// Get event categories (for UI dropdown)
app.get('/api/events/categories', async (req, res) => {
  try {
    // Get distinct categories from the database
    const categories = await eventsCollection.distinct('categories');
    res.json(categories.filter(Boolean).flat());
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ============================================
// VECTOR SEARCH ENDPOINTS
// ============================================

const GEMINI_EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

// Cache for query embeddings
const embeddingCache = new Map();

/**
 * Get embedding for a query string using Gemini
 */
async function getQueryEmbedding(query) {
  // Check cache first
  if (embeddingCache.has(query)) {
    return embeddingCache.get(query);
  }

  try {
    const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text: query }]
        }
      })
    });

    if (!response.ok) {
      console.error('Embedding API error:', response.status);
      return null;
    }

    const data = await response.json();
    const embedding = data.embedding?.values || null;

    // Cache the result
    if (embedding) {
      embeddingCache.set(query, embedding);
      // Limit cache size
      if (embeddingCache.size > 1000) {
        const firstKey = embeddingCache.keys().next().value;
        embeddingCache.delete(firstKey);
      }
    }

    return embedding;
  } catch (error) {
    console.error('Embedding error:', error);
    return null;
  }
}

/**
 * POST /api/places/vibe-search
 * Semantic vector search for places
 */
app.post('/api/places/vibe-search', async (req, res) => {
  const startTime = Date.now();

  try {
    const { query, limit = 10, filters = {}, placeType } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Define category filters for different place types
    // Restaurants: any place with food/dining related categories
    const restaurantKeywords = ['restaurant', 'food', 'dining', 'cafe', 'coffee', 'bakery', 'bar', 'pub', 'pizza', 'sushi', 'seafood', 'deli', 'brunch', 'breakfast', 'lunch', 'dinner', 'steak', 'bagel', 'dessert', 'ice cream', 'tea house', 'wine bar', 'night club', 'confectionery', 'butcher', 'grocery', 'supermarket', 'liquor', 'catering', 'meal'];
    // Landmarks: non-food places like attractions, venues, hotels, etc.
    const landmarkKeywords = ['stadium', 'arena', 'tourist attraction', 'hotel', 'lodging', 'hospital', 'sports complex', 'athletic field', 'sports activity', 'bowling', 'event venue', 'bed and breakfast', 'market', 'florist', 'corporate office', 'store'];

    // Get embedding for the query  
    const queryEmbedding = await getQueryEmbedding(query);

    let results;

    if (placeType === 'landmark') {
      const landmarksCollection = db.collection('boston_landmarks');
      console.log(`[VibeSearch] Searching landmarks for: ${query}`);
      const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      const regexPattern = searchTerms.join('|');

      const searchTarget = query.toLowerCase() === 'popular boston' || query.toLowerCase() === 'popular restaurant boston' ? {} : {
        $or: [
          { name: { $regex: regexPattern, $options: 'i' } },
          { categories: { $regex: regexPattern, $options: 'i' } },
          { primary_category: { $regex: regexPattern, $options: 'i' } }
        ]
      };

      const rawLandmarks = await landmarksCollection
        .find(searchTarget)
        .sort({ rating: -1, user_rating_count: -1 })
        .limit(limit)
        .toArray();

      // Map fields to match places schema for frontend compatibility
      results = rawLandmarks.map(l => ({
        ...l,
        businessname: l.name,
        latitude: l.lat?.toString(),
        longitude: l.lng?.toString(),
        type: 'place'
      }));
    } else if (queryEmbedding) {
      // Use vector search if embedding is available for places
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vibe_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 150,
            limit: limit * 3 // Fetch more to filter by type
          }
        },
        {
          $addFields: {
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      // Add placeType filter (only for restaurant or all)
      if (placeType === 'restaurant') {
        // Restaurants: places with food-related categories
        pipeline.push({
          $match: {
            categories: { $elemMatch: { $regex: restaurantKeywords.join('|'), $options: 'i' } }
          }
        });
      }

      // Add filters if provided
      if (filters.categories && filters.categories.length > 0) {
        pipeline.push({
          $match: {
            categories: { $regex: filters.categories.join('|'), $options: 'i' }
          }
        });
      }

      if (filters.minRating) {
        pipeline.push({
          $match: { rating: { $gte: filters.minRating } }
        });
      }

      if (filters.maxPriceLevel) {
        pipeline.push({
          $match: { price_level: { $lte: filters.maxPriceLevel } }
        });
      }

      // Limit results after filtering
      pipeline.push({ $limit: limit });

      // Project only needed fields
      pipeline.push({
        $project: {
          embedding: 0 // Exclude large embedding array from response
        }
      });

      results = await placesCollection.aggregate(pipeline).toArray();
    } else {
      // Fallback to text search if embedding fails
      console.log('Falling back to text search for:', query);
      const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      const regexPattern = searchTerms.join('|');

      results = await placesCollection
        .find({
          $or: [
            { businessname: { $regex: regexPattern, $options: 'i' } },
            { categories: { $regex: regexPattern, $options: 'i' } }
          ]
        })
        .limit(limit)
        .project({ embedding: 0 })
        .toArray();
    }

    const took_ms = Date.now() - startTime;

    res.json({
      results,
      query,
      count: results.length,
      took_ms
    });

  } catch (error) {
    console.error('Vibe search error:', error);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

/**
 * GET /api/places/hero
 * Get hero options based on transit speed and time of day
 */
app.get('/api/places/hero', async (req, res) => {
  try {
    const { query, transitSpeed = 50 } = req.query;
    const hour = new Date().getHours();
    const speed = parseInt(transitSpeed);

    // Determine city pulse
    let cityPulse;
    if (speed < 25) cityPulse = 'slow';
    else if (speed < 50) cityPulse = 'moderate';
    else if (speed < 75) cityPulse = 'active';
    else cityPulse = 'busy';

    // Determine time-based options
    let timeContext;
    if (hour >= 6 && hour < 11) timeContext = 'morning';
    else if (hour >= 11 && hour < 14) timeContext = 'lunch';
    else if (hour >= 14 && hour < 17) timeContext = 'afternoon';
    else if (hour >= 17 && hour < 21) timeContext = 'dinner';
    else timeContext = 'night';

    // Generate options based on context
    const optionSets = {
      morning: [
        { id: 'coffee', emoji: '☕', label: 'Coffee', query: 'coffee cafe morning breakfast' },
        { id: 'brunch', emoji: '🥞', label: 'Brunch', query: 'brunch breakfast eggs' },
        { id: 'bakery', emoji: '🥐', label: 'Bakery', query: 'bakery pastry fresh' },
        { id: 'parks', emoji: '🌳', label: 'Parks', query: 'park outdoor morning walk' }
      ],
      lunch: [
        { id: 'quick', emoji: '🥪', label: 'Quick Bite', query: 'lunch quick sandwich fast casual' },
        { id: 'healthy', emoji: '🥗', label: 'Healthy', query: 'salad healthy lunch light' },
        { id: 'asian', emoji: '🍜', label: 'Asian', query: 'asian noodles ramen pho' },
        { id: 'deli', emoji: '🥓', label: 'Deli', query: 'deli sandwich sub lunch' }
      ],
      afternoon: [
        { id: 'coffee', emoji: '☕', label: 'Coffee', query: 'coffee afternoon cafe' },
        { id: 'dessert', emoji: '🍰', label: 'Dessert', query: 'dessert sweet bakery ice cream' },
        { id: 'happy', emoji: '🍺', label: 'Happy Hour', query: 'bar happy hour drinks' },
        { id: 'museum', emoji: '🏛️', label: 'Museums', query: 'museum gallery art culture' }
      ],
      dinner: [
        { id: 'italian', emoji: '🍝', label: 'Italian', query: 'italian pasta dinner romantic' },
        { id: 'seafood', emoji: '🦞', label: 'Seafood', query: 'seafood lobster oyster boston' },
        { id: 'steakhouse', emoji: '🥩', label: 'Steakhouse', query: 'steak steakhouse dinner upscale' },
        { id: 'datenight', emoji: '🕯️', label: 'Date Night', query: 'romantic dinner date cozy' }
      ],
      night: [
        { id: 'bars', emoji: '🍸', label: 'Bars', query: 'bar cocktails nightlife drinks' },
        { id: 'live', emoji: '🎵', label: 'Live Music', query: 'live music concert jazz' },
        { id: 'club', emoji: '🪩', label: 'Clubs', query: 'club dance nightclub party' },
        { id: 'latenight', emoji: '🌙', label: 'Late Night', query: 'late night food open late' }
      ]
    };

    let options = [...optionSets[timeContext]];

    // Adjust based on pulse
    if (cityPulse === 'busy') {
      options[0] = { id: 'trending', emoji: '🔥', label: 'Trending', query: 'popular trending busy crowded' };
    } else if (cityPulse === 'slow') {
      options[3] = { id: 'quiet', emoji: '🤫', label: 'Quiet Spots', query: 'quiet peaceful relaxed hidden gem' };
    }

    res.json({
      options,
      transitSpeed: speed,
      cityPulse,
      timeContext
    });

  } catch (error) {
    console.error('Hero options error:', error);
    res.status(500).json({ error: 'Failed to get hero options' });
  }
});

/**
 * GET /api/places/infinite
 * Cursor-based pagination for virtual scrolling
 */
app.get('/api/places/infinite', async (req, res) => {
  try {
    const { cursor, limit = 10, query } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    let matchQuery = {};
    let searchFilter = null;

    // If there's a search query, filter by it
    if (query && query.trim()) {
      const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      if (searchTerms.length > 0) {
        const regexPattern = searchTerms.join('|');
        searchFilter = {
          $or: [
            { businessname: { $regex: regexPattern, $options: 'i' } },
            { categories: { $regex: regexPattern, $options: 'i' } }
          ]
        };
      }
    }

    // Build final query - combine search filter and cursor
    if (cursor) {
      const cleanCursor = String(cursor).trim();

      // Validate cursor is a valid ObjectId format (24 hex characters)
      if (cleanCursor && /^[0-9a-fA-F]{24}$/.test(cleanCursor)) {
        const { ObjectId } = await import('mongodb');
        const cursorFilter = { _id: { $gt: new ObjectId(cleanCursor) } };

        if (searchFilter) {
          matchQuery = { $and: [searchFilter, cursorFilter] };
        } else {
          matchQuery = cursorFilter;
        }
      } else {
        // Invalid cursor - just use search filter if present
        console.log('[Infinite] Invalid cursor format, ignoring:', cleanCursor?.substring(0, 30));
        if (searchFilter) {
          matchQuery = searchFilter;
        }
      }
    } else if (searchFilter) {
      matchQuery = searchFilter;
    }

    const items = await placesCollection
      .find(matchQuery)
      .sort({ _id: 1 })
      .limit(limitNum + 1) // Fetch one extra to check if there's more
      .project({ embedding: 0 })
      .toArray();

    const hasMore = items.length > limitNum;
    if (hasMore) {
      items.pop(); // Remove the extra item
    }

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

    // Get total count for the search (not affected by cursor)
    const countQuery = searchFilter || {};
    const total = await placesCollection.countDocuments(countQuery);

    res.json({
      items,
      nextCursor,
      hasMore,
      total
    });

  } catch (error) {
    console.error('Infinite scroll error:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

// ============================================
// EVENTS VECTOR SEARCH
// ============================================

/**
 * POST /api/events/vibe-search
 * Semantic vector search for events
 */
app.post('/api/events/vibe-search', async (req, res) => {
  const startTime = Date.now();

  try {
    const { query, limit = 50, filters = {} } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const queryEmbedding = await getQueryEmbedding(query);
    let results;
    let searchMethod = 'text';

    if (queryEmbedding) {
      try {
        const pipeline = [
          {
            $vectorSearch: {
              index: 'events_vibe_index',
              path: 'embedding',
              queryVector: queryEmbedding,
              numCandidates: 200,
              limit: limit
            }
          },
          {
            $addFields: {
              score: { $meta: 'vectorSearchScore' }
            }
          }
        ];

        // Date filter
        if (filters.startDate) {
          pipeline.push({
            $match: { start_time: { $gte: filters.startDate } }
          });
        }

        // Category filter
        if (filters.categories && filters.categories.length > 0) {
          pipeline.push({
            $match: {
              categories: { $elemMatch: { $regex: filters.categories.join('|'), $options: 'i' } }
            }
          });
        }

        pipeline.push({ $project: { embedding: 0 } });

        results = await eventsCollection.aggregate(pipeline).toArray();
        searchMethod = 'vector';
        console.log(`[Events] Vector search for "${query}" returned ${results.length} results`);
      } catch (vectorErr) {
        // Vector search failed (index might not exist), fallback to text search
        console.warn('[Events] Vector search failed, falling back to text search:', vectorErr.message);
        results = null;
      }
    }

    // Fallback to text search if vector search failed or no embedding
    if (!results) {
      console.log('[Events] Using text search for:', query);
      const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

      let findQuery = {};
      if (searchTerms.length > 0) {
        const regexPattern = searchTerms.join('|');
        findQuery = {
          $or: [
            { title: { $regex: regexPattern, $options: 'i' } },
            { description: { $regex: regexPattern, $options: 'i' } },
            { 'venue.name': { $regex: regexPattern, $options: 'i' } },
            { category: { $regex: regexPattern, $options: 'i' } }
          ]
        };
      }

      results = await eventsCollection
        .find(findQuery)
        .sort({ start_time: 1 }) // Sort by upcoming first
        .limit(limit)
        .project({ embedding: 0 })
        .toArray();

      console.log(`[Events] Text search returned ${results.length} results`);
    }

    res.json({
      results,
      query,
      count: results.length,
      searchMethod,
      took_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('Events vibe search error:', error);
    res.status(500).json({ error: 'Failed to search events' });
  }
});

// ============================================
// REDDIT/HIDDEN EVENTS TEXT SEARCH  
// (No vector index needed - uses text search)
// ============================================

let redditCollection;

/**
 * POST /api/reddit/vibe-search
 * Text search for reddit/hidden events posts (no vector index required)
 */
app.post('/api/reddit/vibe-search', async (req, res) => {
  const startTime = Date.now();

  try {
    // Initialize reddit collection if not done
    if (!redditCollection) {
      redditCollection = db.collection('hidden_events');
    }

    const { query, limit = 20, filters = {} } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Use text search (no vector index needed)
    console.log('[Reddit] Text search for:', query);
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const regexPattern = searchTerms.length > 0 ? searchTerms.join('|') : query;

    const matchQuery = {
      $or: [
        { title: { $regex: regexPattern, $options: 'i' } },
        { text: { $regex: regexPattern, $options: 'i' } },
        { context: { $regex: regexPattern, $options: 'i' } },
        { categories: { $elemMatch: { $regex: regexPattern, $options: 'i' } } }
      ]
    };

    if (filters.hiddenGemsOnly) matchQuery.isHiddenGem = true;
    if (filters.subreddit) matchQuery.subreddit = filters.subreddit;
    if (filters.minUpvotes) matchQuery.ups = { $gte: filters.minUpvotes };

    const results = await redditCollection
      .find(matchQuery)
      .sort({ ups: -1, relevanceScore: -1 })
      .limit(limit)
      .project({ embedding: 0 })
      .toArray();

    console.log(`[Reddit] Found ${results.length} results for "${query}"`);

    res.json({
      results,
      query,
      count: results.length,
      took_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('Reddit vibe search error:', error);
    res.status(500).json({ error: 'Failed to search reddit posts' });
  }
});

/**
 * GET /api/reddit/hidden-gems
 * Get highly-upvoted hidden gem recommendations
 */
app.get('/api/reddit/hidden-gems', async (req, res) => {
  try {
    if (!redditCollection) {
      redditCollection = db.collection('hidden_events');
    }

    const { limit = 10 } = req.query;

    const gems = await redditCollection
      .find({ isHiddenGem: true })
      .sort({ ups: -1, relevanceScore: -1 })
      .limit(parseInt(limit))
      .project({ embedding: 0 })
      .toArray();

    res.json({
      results: gems,
      count: gems.length
    });

  } catch (error) {
    console.error('Hidden gems error:', error);
    res.status(500).json({ error: 'Failed to fetch hidden gems' });
  }
});

// ============================================
// UNIFIED SEARCH (All collections)
// ============================================

/**
 * POST /api/search/unified
 * Search across places, events, and reddit simultaneously
 */
app.post('/api/search/unified', async (req, res) => {
  const startTime = Date.now();

  try {
    const { query, limit = 10 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Initialize reddit collection
    if (!redditCollection) {
      redditCollection = db.collection('hidden_events');
    }

    const queryEmbedding = await getQueryEmbedding(query);

    // Search all three collections in parallel
    const [places, events, reddit] = await Promise.all([
      // Places search
      queryEmbedding
        ? placesCollection.aggregate([
          { $vectorSearch: { index: 'vibe_index', path: 'embedding', queryVector: queryEmbedding, numCandidates: 50, limit: limit } },
          { $addFields: { score: { $meta: 'vectorSearchScore' }, type: 'place' } },
          { $project: { embedding: 0 } }
        ]).toArray()
        : placesCollection.find({ businessname: { $regex: query, $options: 'i' } }).limit(limit).project({ embedding: 0 }).toArray().then(r => r.map(p => ({ ...p, type: 'place' }))),

      // Events search
      queryEmbedding
        ? eventsCollection.aggregate([
          { $vectorSearch: { index: 'events_vibe_index', path: 'embedding', queryVector: queryEmbedding, numCandidates: 50, limit: limit } },
          { $addFields: { score: { $meta: 'vectorSearchScore' }, type: 'event' } },
          { $project: { embedding: 0 } }
        ]).toArray()
        : eventsCollection.find({ title: { $regex: query, $options: 'i' } }).limit(limit).project({ embedding: 0 }).toArray().then(r => r.map(e => ({ ...e, type: 'event' }))),

      // Reddit search (always text search - no vector index)
      redditCollection.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { text: { $regex: query, $options: 'i' } },
          { context: { $regex: query, $options: 'i' } }
        ]
      }).sort({ ups: -1 }).limit(limit).project({ embedding: 0 }).toArray().then(r => r.map(p => ({ ...p, type: 'reddit' })))
    ]);

    res.json({
      query,
      places: { results: places, count: places.length },
      events: { results: events, count: events.length },
      reddit: { results: reddit, count: reddit.length },
      took_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('Unified search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
});
