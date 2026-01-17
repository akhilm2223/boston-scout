/// <reference types="google.maps" />

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let placesService: google.maps.places.PlacesService | null = null;
let mapInstance: google.maps.Map | null = null;

// Initialize the Google Maps script
export const loadGoogleMapsScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve();
            return;
        }

        if (document.getElementById('google-maps-script')) {
            // Already loading
            const script = document.getElementById('google-maps-script') as HTMLScriptElement;
            script.addEventListener('load', () => resolve());
            script.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')));
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Maps script'));
        document.head.appendChild(script);
    });
};

// Initialize service with a hidden map element (required for PlacesService)
const initService = async () => {
    if (!placesService) {
        await loadGoogleMapsScript();
        const mapDiv = document.createElement('div');
        mapInstance = new google.maps.Map(mapDiv, {
            center: { lat: 42.3601, lng: -71.0589 }, // Boston
            zoom: 15,
        });
        placesService = new google.maps.places.PlacesService(mapInstance);
    }
    return placesService;
};

export interface GooglePlaceResult {
    id: string;
    name: string;
    location: { lat: number; lng: number };
    rating: number;
    user_ratings_total: number;
    price_level: number;
    types: string[];
    photos: string[];
    formatted_address: string;
    business_status: string;
}

export const searchPlaces = async (query: string): Promise<GooglePlaceResult[]> => {
    console.log('Searching places with key:', GOOGLE_MAPS_API_KEY ? `${GOOGLE_MAPS_API_KEY.substring(0, 5)}...` : 'MISSING');
    const service = await initService();

    const request: google.maps.places.TextSearchRequest = {
        query: query,
        location: mapInstance?.getCenter(),
        radius: 5000,
    };

    return new Promise((resolve, reject) => {
        service.textSearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                const formattedResults = results.map(place => ({
                    id: place.place_id || '',
                    name: place.name || 'Unknown',
                    location: {
                        lat: place.geometry?.location?.lat() || 0,
                        lng: place.geometry?.location?.lng() || 0
                    },
                    rating: place.rating || 0,
                    user_ratings_total: place.user_ratings_total || 0,
                    price_level: place.price_level || 0,
                    types: place.types || [],
                    formatted_address: place.formatted_address || '',
                    business_status: place.business_status || '',
                    // Get first photo URL if available
                    photos: place.photos?.map(photo => photo.getUrl({ maxWidth: 400 })) || []
                }));
                resolve(formattedResults);
            } else {
                // Even if zero results, resolve with empty array
                if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    resolve([]);
                } else {
                    console.error('Google Places Search failed:', status);
                    resolve([]); // Fail gracefully
                }
            }
        });
    });
};
