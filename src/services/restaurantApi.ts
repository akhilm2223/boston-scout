// Restaurant API Service - MongoDB Integration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Restaurant {
  _id: string;
  businessname: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  rating?: number;
  user_rating_count?: number;
  categories?: string[];
  price_level?: number;
  phone?: string;
  website?: string;
  google_maps_url?: string;
  photo_name?: string;
  dine_in?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  reservable?: boolean;
  serves_breakfast?: boolean;
  serves_lunch?: boolean;
  serves_dinner?: boolean;
  serves_brunch?: boolean;
  outdoor_seating?: boolean;
  good_for_groups?: boolean;
}

// Fetch all restaurants from MongoDB
export async function fetchRestaurants(): Promise<Restaurant[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/places`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch restaurants:', error);
    return [];
  }
}

// Convert restaurants to GeoJSON for Mapbox
export function restaurantsToGeoJSON(restaurants: Restaurant[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = restaurants
    .filter(r => r.latitude && r.longitude)
    .map(restaurant => {
      const lat = parseFloat(restaurant.latitude);
      const lng = parseFloat(restaurant.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return null;

      // Determine marker color based on rating
      let markerColor = '#888888'; // gray default
      if (restaurant.rating) {
        if (restaurant.rating >= 4.5) markerColor = '#10b981'; // green - excellent
        else if (restaurant.rating >= 4.0) markerColor = '#3b82f6'; // blue - great
        else if (restaurant.rating >= 3.5) markerColor = '#f59e0b'; // amber - good
        else markerColor = '#ef4444'; // red - average
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat]
        },
        properties: {
          id: restaurant._id,
          name: restaurant.businessname,
          address: restaurant.address,
          city: restaurant.city,
          rating: restaurant.rating || 0,
          ratingCount: restaurant.user_rating_count || 0,
          categories: restaurant.categories?.join(', ') || '',
          priceLevel: restaurant.price_level || 0,
          phone: restaurant.phone || '',
          website: restaurant.website || '',
          googleMapsUrl: restaurant.google_maps_url || '',
          photoName: restaurant.photo_name || '',
          markerColor,
          // Features
          dineIn: restaurant.dine_in || false,
          takeout: restaurant.takeout || false,
          delivery: restaurant.delivery || false,
          reservable: restaurant.reservable || false,
          breakfast: restaurant.serves_breakfast || false,
          lunch: restaurant.serves_lunch || false,
          dinner: restaurant.serves_dinner || false,
          brunch: restaurant.serves_brunch || false,
          outdoor: restaurant.outdoor_seating || false,
          groups: restaurant.good_for_groups || false,
        },
      };
    })
    .filter(f => f !== null) as GeoJSON.Feature[];

  return { type: 'FeatureCollection', features };
}

// Get price level string
export function getPriceLevel(level: number): string {
  if (level === 0) return 'N/A';
  return '$'.repeat(level);
}
