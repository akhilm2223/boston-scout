

export interface Landmark {
    _id: string;
    name: string;
    description: string;
    category: string; // historical, museum, park, monument, attraction
    address: string;
    latitude: number;
    longitude: number;
    imageUrl?: string;
    website?: string;
    visitDuration?: string;
    free?: boolean;
}

// Famous Boston Landmarks - Static data for now
// NYC Landmarks - To be populated or fetched from API
export const CITY_LANDMARKS: Landmark[] = [];

// Fetch landmarks
export async function fetchLandmarks(): Promise<Landmark[]> {
    // For now, return empty array until NYC data is integrated
    // Can be replaced with API call: fetch(`${API_BASE_URL}/api/landmarks`)
    return CITY_LANDMARKS;
}

// Convert landmarks to GeoJSON for Mapbox
export function landmarksToGeoJSON(landmarks: Landmark[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = landmarks
        .filter(l => l.latitude && l.longitude)
        .map(landmark => {
            // Determine marker color based on category
            let markerColor = '#8b5cf6'; // purple default
            switch (landmark.category) {
                case 'historical':
                    markerColor = '#b45309'; // amber/brown for historical
                    break;
                case 'museum':
                    markerColor = '#7c3aed'; // purple for museums
                    break;
                case 'park':
                    markerColor = '#059669'; // green for parks
                    break;
                case 'monument':
                    markerColor = '#64748b'; // slate for monuments
                    break;
                case 'attraction':
                    markerColor = '#0891b2'; // cyan for attractions
                    break;
            }

            return {
                type: 'Feature' as const,
                geometry: {
                    type: 'Point' as const,
                    coordinates: [landmark.longitude, landmark.latitude]
                },
                properties: {
                    id: landmark._id,
                    name: landmark.name,
                    description: landmark.description,
                    category: landmark.category,
                    address: landmark.address,
                    visitDuration: landmark.visitDuration || '',
                    free: landmark.free || false,
                    website: landmark.website || '',
                    markerColor,
                },
            };
        });

    return { type: 'FeatureCollection', features };
}

// Get category icon
export function getCategoryIcon(category: string): string {
    switch (category) {
        case 'historical': return '🏛️';
        case 'museum': return '🎨';
        case 'park': return '🌳';
        case 'monument': return '🗽';
        case 'attraction': return '⭐';
        default: return '📍';
    }
}
