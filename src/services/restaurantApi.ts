// Places API Service - MongoDB Integration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Place {
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
  // Fields for landmarks source
  name?: string;
  lat?: number;
  lng?: number;
}

// Fetch all places from MongoDB
export async function fetchPlaces(): Promise<Place[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/places`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch places:', error);
    return [];
  }
}

// Convert places to GeoJSON for Mapbox
export function placesToGeoJSON(places: Place[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = places
    .filter(r => r.latitude && r.longitude)
    .map(place => {
      const lat = parseFloat(place.latitude);
      const lng = parseFloat(place.longitude);

      if (isNaN(lat) || isNaN(lng)) return null;

      // Determine marker color based on rating
      let markerColor = '#888888'; // gray default
      if (place.rating) {
        if (place.rating >= 4.5) markerColor = '#10b981'; // green - excellent
        else if (place.rating >= 4.0) markerColor = '#3b82f6'; // blue - great
        else if (place.rating >= 3.5) markerColor = '#f59e0b'; // amber - good
        else markerColor = '#ef4444'; // red - average
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat]
        },
        properties: {
          id: place._id,
          name: place.businessname,
          address: place.address,
          city: place.city,
          rating: place.rating || 0,
          ratingCount: place.user_rating_count || 0,
          categories: place.categories?.join(', ') || '',
          priceLevel: place.price_level || 0,
          phone: place.phone || '',
          website: place.website || '',
          googleMapsUrl: place.google_maps_url || '',
          photoName: place.photo_name || '',
          markerColor,
          // Features
          dineIn: place.dine_in || false,
          takeout: place.takeout || false,
          delivery: place.delivery || false,
          reservable: place.reservable || false,
          breakfast: place.serves_breakfast || false,
          lunch: place.serves_lunch || false,
          dinner: place.serves_dinner || false,
          brunch: place.serves_brunch || false,
          outdoor: place.outdoor_seating || false,
          groups: place.good_for_groups || false,
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

// Fetch landmarks (non-restaurant places) from MongoDB
export async function fetchLandmarks(): Promise<Place[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/landmarks`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch landmarks:', error);
    return [];
  }
}

// Convert landmarks to GeoJSON for Mapbox (with different coloring)
export function landmarksToGeoJSON(landmarks: Place[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = landmarks
    .filter(r => (r.latitude && r.longitude) || (r.lat && r.lng))
    .map(place => {
      // Handle both boston_places and boston_landmarks schemas
      const lat = place.lat !== undefined ? place.lat : parseFloat(place.latitude || '0');
      const lng = place.lng !== undefined ? place.lng : parseFloat(place.longitude || '0');
      const displayName = place.name || place.businessname || 'Unknown Landmark';

      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

      // Use a purple/landmark color scheme
      const markerColor = '#8b5cf6'; // purple for landmarks

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat]
        },
        properties: {
          id: place._id,
          name: displayName,
          address: place.address,
          city: place.city || 'Boston',
          rating: place.rating || 0,
          ratingCount: place.user_rating_count || 0,
          categories: place.categories?.join(', ') || '',
          phone: place.phone || '',
          website: place.website || '',
          googleMapsUrl: place.google_maps_url || '',
          photoName: place.photo_name || '',
          markerColor,
        },
      };
    })
    .filter(f => f !== null) as GeoJSON.Feature[];

  return { type: 'FeatureCollection', features };
}
