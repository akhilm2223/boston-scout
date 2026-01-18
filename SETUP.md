# Boston 3D City - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Backend Server (MongoDB API)
In one terminal:
```bash
npm run server
```

This will:
- Connect to MongoDB
- Serve restaurant data from `boston_database.boston_places`
- Run on `http://localhost:3000`

### 3. Start the Frontend (Vite Dev Server)
In another terminal:
```bash
npm run dev
```

This will:
- Start the React app with Vite
- Run on `http://localhost:5173`
- Show 3D map with MBTA transit + 3,008 restaurants

### Or Run Both Together
```bash
npm run dev:all
```

## What You'll See

### On the 3D Map:
- **3,008 Restaurant Markers** (color-coded by rating)
  - 🟢 Green: 4.5+ stars (excellent)
  - 🔵 Blue: 4.0-4.5 stars (great)
  - 🟠 Amber: 3.5-4.0 stars (good)
  - 🔴 Red: <3.5 stars (average)
  
- **Click any restaurant** to see:
  - Name, address, rating
  - Categories (Italian, Seafood, etc.)
  - Features (Dine-in, Takeout, Delivery, Outdoor seating)
  - Phone number & Google Maps link

- **MBTA Transit** (real-time)
  - Trains, subways, buses
  - Live vehicle tracking
  - Route lines

### Zoom Levels:
- Zoom 13+: Restaurant markers appear
- Zoom 15+: Restaurant names show

## API Endpoints

### Get All Restaurants
```
GET http://localhost:3000/api/restaurants
```

### Filter Restaurants
```
GET http://localhost:3000/api/places/filter?minRating=4.5&features=outdoor_seating,reservable
```

Parameters:
- `minRating`: Minimum rating (e.g., 4.0)
- `priceLevel`: Price level 1-4
- `category`: Category name (e.g., "Italian")
- `features`: Comma-separated features (e.g., "dine_in,outdoor_seating")

### Get Single Place
```
GET http://localhost:3000/api/places/:id
```

## Database Info

**MongoDB Cluster:** `boston_scout`
**Database:** `boston_database`
**Collection:** `boston_places`
**Total Restaurants:** 3,008

Each restaurant has:
- Location (lat/lng)
- Google data (rating, reviews, place_id)
- Features (dine-in, takeout, delivery, reservations)
- Meal types (breakfast, lunch, dinner, brunch)
- Amenities (outdoor seating, live music, good for groups)

## Troubleshooting

### Restaurants not showing?
1. Check backend is running: `http://localhost:3000/api/places`
2. Check browser console for errors
3. Zoom in to level 13+ on the map

### Backend connection error?
- Verify `.env` has correct `MONGODB_URI`
- Check MongoDB cluster is accessible

### CORS errors?
- Backend has CORS enabled for all origins
- Check `server.js` has `app.use(cors())`
