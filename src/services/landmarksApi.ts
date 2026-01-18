// Landmarks API Service - Boston Historical and Tourist Landmarks
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
export const BOSTON_LANDMARKS: Landmark[] = [
    {
        _id: 'landmark-1',
        name: 'Freedom Trail',
        description: 'A 2.5-mile-long path through downtown Boston that passes by 16 locations significant to the history of the United States.',
        category: 'historical',
        address: 'Boston Common, Boston, MA',
        latitude: 42.3554,
        longitude: -71.0640,
        visitDuration: '2-3 hours',
        free: true,
        website: 'https://www.thefreedomtrail.org/'
    },
    {
        _id: 'landmark-2',
        name: 'Fenway Park',
        description: 'America\'s Most Beloved Ballpark and home of the Boston Red Sox since 1912.',
        category: 'attraction',
        address: '4 Jersey St, Boston, MA 02215',
        latitude: 42.3467,
        longitude: -71.0972,
        visitDuration: '3-4 hours',
        free: false,
        website: 'https://www.mlb.com/redsox/ballpark'
    },
    {
        _id: 'landmark-3',
        name: 'Boston Common',
        description: 'The oldest public park in the United States, dating back to 1634.',
        category: 'park',
        address: 'Boston Common, Boston, MA 02108',
        latitude: 42.3550,
        longitude: -71.0657,
        visitDuration: '1-2 hours',
        free: true
    },
    {
        _id: 'landmark-4',
        name: 'Museum of Fine Arts',
        description: 'One of the largest art museums in the United States with a collection of more than 500,000 works.',
        category: 'museum',
        address: '465 Huntington Ave, Boston, MA 02115',
        latitude: 42.3394,
        longitude: -71.0940,
        visitDuration: '3-4 hours',
        free: false,
        website: 'https://www.mfa.org/'
    },
    {
        _id: 'landmark-5',
        name: 'New England Aquarium',
        description: 'Home to thousands of aquatic animals from around the world including penguins, sea lions, and a giant ocean tank.',
        category: 'attraction',
        address: '1 Central Wharf, Boston, MA 02110',
        latitude: 42.3591,
        longitude: -71.0498,
        visitDuration: '2-3 hours',
        free: false,
        website: 'https://www.neaq.org/'
    },
    {
        _id: 'landmark-6',
        name: 'Paul Revere House',
        description: 'The colonial home of American patriot Paul Revere during the time of the American Revolution.',
        category: 'historical',
        address: '19 North Square, Boston, MA 02113',
        latitude: 42.3636,
        longitude: -71.0536,
        visitDuration: '1 hour',
        free: false,
        website: 'https://www.paulreverehouse.org/'
    },
    {
        _id: 'landmark-7',
        name: 'Old North Church',
        description: 'Boston\'s oldest surviving church building and the location of the famous "One if by land, two if by sea" signal.',
        category: 'historical',
        address: '193 Salem St, Boston, MA 02113',
        latitude: 42.3664,
        longitude: -71.0545,
        visitDuration: '30-45 minutes',
        free: true
    },
    {
        _id: 'landmark-8',
        name: 'Harvard University',
        description: 'The oldest institution of higher education in the United States, founded in 1636.',
        category: 'attraction',
        address: 'Cambridge, MA 02138',
        latitude: 42.3770,
        longitude: -71.1167,
        visitDuration: '2-3 hours',
        free: true,
        website: 'https://www.harvard.edu/'
    },
    {
        _id: 'landmark-9',
        name: 'MIT Campus',
        description: 'Massachusetts Institute of Technology - world-renowned for engineering and technology education.',
        category: 'attraction',
        address: '77 Massachusetts Ave, Cambridge, MA 02139',
        latitude: 42.3601,
        longitude: -71.0942,
        visitDuration: '2 hours',
        free: true,
        website: 'https://www.mit.edu/'
    },
    {
        _id: 'landmark-10',
        name: 'Faneuil Hall Marketplace',
        description: 'Historic marketplace and meeting hall in downtown Boston, known as "The Cradle of Liberty".',
        category: 'historical',
        address: '1 Faneuil Hall Square, Boston, MA 02109',
        latitude: 42.3601,
        longitude: -71.0557,
        visitDuration: '1-2 hours',
        free: true,
        website: 'https://faneuilhallmarketplace.com/'
    },
    {
        _id: 'landmark-11',
        name: 'Boston Public Garden',
        description: 'America\'s first public botanical garden, famous for its Swan Boats and Victorian-era beauty.',
        category: 'park',
        address: '4 Charles St, Boston, MA 02108',
        latitude: 42.3540,
        longitude: -71.0708,
        visitDuration: '1-2 hours',
        free: true
    },
    {
        _id: 'landmark-12',
        name: 'USS Constitution',
        description: 'The world\'s oldest commissioned warship still afloat, nicknamed "Old Ironsides".',
        category: 'historical',
        address: 'Charlestown Navy Yard, Boston, MA 02129',
        latitude: 42.3725,
        longitude: -71.0557,
        visitDuration: '1-2 hours',
        free: true,
        website: 'https://ussconstitutionmuseum.org/'
    },
    {
        _id: 'landmark-13',
        name: 'Bunker Hill Monument',
        description: 'A 221-foot granite obelisk commemorating the Battle of Bunker Hill, one of the first major battles of the American Revolution.',
        category: 'monument',
        address: 'Monument Square, Charlestown, MA 02129',
        latitude: 42.3764,
        longitude: -71.0608,
        visitDuration: '1 hour',
        free: true
    },
    {
        _id: 'landmark-14',
        name: 'Boston Tea Party Ships & Museum',
        description: 'Interactive museum and replica ships commemorating the famous Boston Tea Party of 1773.',
        category: 'museum',
        address: '306 Congress St, Boston, MA 02210',
        latitude: 42.3524,
        longitude: -71.0512,
        visitDuration: '1-2 hours',
        free: false,
        website: 'https://www.bostonteapartyship.com/'
    },
    {
        _id: 'landmark-15',
        name: 'Trinity Church',
        description: 'Masterpiece of American architecture and a National Historic Landmark in Copley Square.',
        category: 'historical',
        address: '206 Clarendon St, Boston, MA 02116',
        latitude: 42.3497,
        longitude: -71.0773,
        visitDuration: '30-45 minutes',
        free: false,
        website: 'https://www.trinitychurchboston.org/'
    },
    {
        _id: 'landmark-16',
        name: 'Boston Public Library',
        description: 'The first large free municipal library in the United States, featuring stunning architecture and art.',
        category: 'attraction',
        address: '700 Boylston St, Boston, MA 02116',
        latitude: 42.3493,
        longitude: -71.0781,
        visitDuration: '1-2 hours',
        free: true,
        website: 'https://www.bpl.org/'
    },
    {
        _id: 'landmark-17',
        name: 'Isabella Stewart Gardner Museum',
        description: 'Art museum with an eclectic collection displayed in a Venetian-style palace.',
        category: 'museum',
        address: '25 Evans Way, Boston, MA 02115',
        latitude: 42.3382,
        longitude: -71.0992,
        visitDuration: '2-3 hours',
        free: false,
        website: 'https://www.gardnermuseum.org/'
    },
    {
        _id: 'landmark-18',
        name: 'Massachusetts State House',
        description: 'The state capitol with its iconic golden dome, a symbol of Boston\'s history and government.',
        category: 'historical',
        address: '24 Beacon St, Boston, MA 02133',
        latitude: 42.3587,
        longitude: -71.0638,
        visitDuration: '1 hour',
        free: true
    }
];

// Fetch landmarks (currently from static data, can be extended to MongoDB)
export async function fetchLandmarks(): Promise<Landmark[]> {
    // For now, return static data
    // Can be replaced with API call: fetch(`${API_BASE_URL}/api/landmarks`)
    return BOSTON_LANDMARKS;
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
