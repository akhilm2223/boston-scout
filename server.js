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

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
});
