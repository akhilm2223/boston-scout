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
let restaurantsCollection;
let eventsCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✓ Connected to MongoDB');

    db = client.db('boston_database');
    restaurantsCollection = db.collection('boston_restaurants');
    eventsCollection = db.collection('boston_events');

    const restaurantCount = await restaurantsCollection.countDocuments();
    const eventCount = await eventsCollection.countDocuments();
    console.log(`✓ Found ${restaurantCount} restaurants`);
    console.log(`✓ Found ${eventCount} events`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// API Routes

// Get all restaurants
app.get('/api/restaurants', async (req, res) => {
  try {
    const restaurants = await restaurantsCollection
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

    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Get restaurants by filter
app.get('/api/restaurants/filter', async (req, res) => {
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

    const restaurants = await restaurantsCollection.find(query).toArray();
    res.json(restaurants);
  } catch (error) {
    console.error('Error filtering restaurants:', error);
    res.status(500).json({ error: 'Failed to filter restaurants' });
  }
});

// Get restaurant by ID
app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const restaurant = await restaurantsCollection.findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json(restaurant);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
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

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
});
