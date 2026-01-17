// Events API Service - MongoDB Integration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Fetch all events from MongoDB
export async function fetchEvents(): Promise<BostonEvent[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/events`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return [];
  }
}

// Convert events to GeoJSON for Mapbox
export function eventsToGeoJSON(events: BostonEvent[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = events
    .filter(e => e.venue?.lat && e.venue?.lng)
    .map(event => {
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [event.venue.lng, event.venue.lat]
        },
        properties: {
          id: event._id,
          title: event.title,
          description: event.description,
          startTime: event.start_time,
          endTime: event.end_time,
          venueName: event.venue.name,
          categories: event.categories?.join(', ') || '',
          price: event.price || 'Free',
          source: event.source || '',
          sourceUrl: event.source_url || '',
        },
      };
    });

  return { type: 'FeatureCollection', features };
}

// Format date for display
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format time for display
export function formatEventTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
