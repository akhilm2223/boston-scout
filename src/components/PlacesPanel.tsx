
import { useState, useCallback, useEffect, useMemo } from 'react';
import { BostonEvent, formatEventDate, formatEventTime } from '../services/eventsApi';
import { ItineraryEvent } from '../types';
import { searchPlaces } from '../services/googlePlacesApi';
import './PlacesPanel.css';

// Placeholder images for restaurants
const FOOD_PLACEHOLDER_IMAGES = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1424847651672-bf202175b6d4?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1466978913421-dad938661248?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop',
];

const EVENT_PLACEHOLDER_IMAGES = [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&h=300&fit=crop',
];

const getRestaurantImage = (restaurant: Restaurant, index: number) => {
    if (restaurant.photoUrl) return restaurant.photoUrl;
    return FOOD_PLACEHOLDER_IMAGES[index % FOOD_PLACEHOLDER_IMAGES.length];
};
const getEventImage = (event: BostonEvent, index: number) => event.image_url || EVENT_PLACEHOLDER_IMAGES[index % EVENT_PLACEHOLDER_IMAGES.length];
const PLACEHOLDER_IMAGES = EVENT_PLACEHOLDER_IMAGES; // Backwards compatibility if needed

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Restaurant {
    _id: string;
    businessname: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    rating?: number;
    user_rating_count?: number;
    categories?: string | string[];
    price_level?: number;
    photoUrl?: string; // Real photo from Google
}

interface PlacesPanelProps {
    onAddToItinerary: (event: ItineraryEvent) => void;
    onLocationClick: (location: [number, number], name: string) => void;
}

interface SearchResult {
    classification: {
        categories: string[];
        dateHint: string | null;
        keywords: string[];
    };
    dateRange: { start: string; end: string } | null;
    count: number;
    events: BostonEvent[];
}

export default function PlacesPanel({ onAddToItinerary, onLocationClick }: PlacesPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState<'all' | 'events' | 'restaurants' | 'location'>('all');

    // Data states
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [events, setEvents] = useState<BostonEvent[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

    // Filters
    const [selectedDate, setSelectedDate] = useState('');
    const [minRating, setMinRating] = useState<number>(0);
    const [priceLevel, setPriceLevel] = useState<number | null>(null);

    // Initial load
    useEffect(() => {
        fetchRestaurants();
    }, []);

    const fetchRestaurants = async () => {
        setIsLoadingRestaurants(true);
        try {
            // Use Google Places API
            const results = await searchPlaces('best restaurants in Boston');

            // Map Google results to our Restaurant interface
            const mappedRestaurants: Restaurant[] = results.map(place => ({
                _id: place.id,
                businessname: place.name,
                address: place.formatted_address,
                city: 'Boston',
                latitude: place.location?.lat,
                longitude: place.location?.lng,
                rating: place.rating,
                user_rating_count: place.user_ratings_total,
                categories: place.types,
                price_level: place.price_level,
                photoUrl: place.photos?.[0] // Add photoUrl to our interface usage
            }));

            setRestaurants(mappedRestaurants);
        } catch (err) {
            console.error('Error fetching restaurants:', err);
            setError('Failed to load restaurants');
        } finally {
            setIsLoadingRestaurants(false);
        }
    };

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setError(null);

        try {
            const requestBody: any = { query: searchQuery };
            if (selectedDate) {
                const startOfDay = new Date(selectedDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(selectedDate);
                endOfDay.setHours(23, 59, 59, 999);
                requestBody.startDate = startOfDay.toISOString();
                requestBody.endDate = endOfDay.toISOString();
            }

            const response = await fetch(`${API_BASE_URL} /api/events / search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error('Search failed');
            const result: SearchResult = await response.json();
            setEvents(result.events);
        } catch (err) {
            console.error('Search error:', err);
            setError('Failed to search events');
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, selectedDate]);

    const filteredRestaurants = useMemo(() => {
        let filtered = restaurants;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.businessname?.toLowerCase().includes(query) ||
                (Array.isArray(r.categories) ? r.categories.join(' ') : r.categories)?.toLowerCase().includes(query)
            );
        }
        if (minRating > 0) filtered = filtered.filter(r => (r.rating || 0) >= minRating);
        if (priceLevel !== null) filtered = filtered.filter(r => r.price_level === priceLevel);
        return filtered;
    }, [restaurants, searchQuery, minRating, priceLevel]);

    const handleAddRestaurant = (restaurant: Restaurant) => {
        const catStr = Array.isArray(restaurant.categories) ? restaurant.categories.join(', ') : (restaurant.categories || 'Restaurant');
        onAddToItinerary({
            id: `restaurant - ${restaurant._id} `,
            name: restaurant.businessname,
            location: { lat: restaurant.latitude, lng: restaurant.longitude },
            time: 'Flexible',
            duration: '~1 hour',
            vibe: catStr,
            sentiment: 'positive',
            category: 'food'
        });
        setAddedIds(prev => new Set(prev).add(restaurant._id));
    };

    const handleAddEvent = (event: BostonEvent) => {
        onAddToItinerary({
            id: event._id,
            name: event.title,
            location: { lat: event.venue.lat, lng: event.venue.lng },
            time: formatEventTime(event.start_time),
            duration: 'Event',
            vibe: event.venue.name,
            sentiment: 'positive',
            category: 'event',
            eventData: event
        });
        setAddedIds(prev => new Set(prev).add(event._id));
    };

    return (
        <div className="places-panel">
            <div className="places-search-header">
                <div className="search-row">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search events & restaurants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button className="search-btn" onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? <span className="spinner"></span> : '🔍'}
                    </button>
                </div>

                <div className="filter-chips">
                    <button
                        className={`chip ${activeSection === 'all' ? 'active' : ''} `}
                        onClick={() => setActiveSection('all')}
                    >All</button>
                    <button
                        className={`chip ${activeSection === 'events' ? 'active' : ''} `}
                        onClick={() => setActiveSection('events')}
                    >Events</button>
                    <button
                        className={`chip ${activeSection === 'restaurants' ? 'active' : ''} `}
                        onClick={() => setActiveSection('restaurants')}
                    >Restaurants</button>
                    <button
                        className={`chip ${activeSection === 'location' ? 'active' : ''} `}
                        onClick={() => setActiveSection('location')}
                    >📍 Search Area</button>
                </div>
            </div>

            <div className="places-scroll-area">
                {(activeSection === 'all' || activeSection === 'events') && (
                    <div className="places-section">
                        <div className="section-sticky-header">
                            <span className="section-icon">🎫</span>
                            <h3>Events</h3>
                            <span className="count">{events.length}</span>
                        </div>
                        <div className="section-content">
                            {events.map((event, index) => (
                                <div
                                    key={event._id}
                                    className="place-card event"
                                    onClick={() => onLocationClick([event.venue.lng, event.venue.lat], event.title)}
                                    style={{ '--place-image': `url(${getEventImage(event, index)})` } as React.CSSProperties}
                                >
                                    <div className="card-info">
                                        <h4>{event.title}</h4>
                                        <p className="meta">{formatEventDate(event.start_time)} • {formatEventTime(event.start_time)}</p>
                                        <p className="venue">{event.venue.name}</p>
                                    </div>
                                    <button
                                        className={`add - btn ${addedIds.has(event._id) ? 'added' : ''} `}
                                        onClick={(e) => { e.stopPropagation(); handleAddEvent(event); }}
                                    >
                                        {addedIds.has(event._id) ? '✓' : '+'}
                                    </button>
                                </div>
                            ))}
                            {events.length === 0 && <p className="empty">No events found. Try searching.</p>}
                        </div>
                    </div>
                )}

                {(activeSection === 'all' || activeSection === 'restaurants') && (
                    <div className="places-section">
                        <div className="section-sticky-header">
                            <span className="section-icon">🍽️</span>
                            <h3>Restaurants</h3>
                            <span className="count">{filteredRestaurants.length}</span>
                        </div>
                        <div className="section-content">
                            {filteredRestaurants.slice(0, 50).map((restaurant, index) => (
                                <div
                                    key={restaurant._id}
                                    className="place-card restaurant"
                                    onClick={() => onLocationClick([restaurant.longitude, restaurant.latitude], restaurant.businessname)}
                                    style={{ '--place-image': `url(${getRestaurantImage(restaurant, index)})` } as React.CSSProperties}
                                >
                                    <div className="card-info">
                                        <h4>{restaurant.businessname}</h4>
                                        <div className="meta">
                                            {restaurant.rating && <span className="rating">★ {restaurant.rating}</span>}
                                            {restaurant.price_level && <span className="price">{'$'.repeat(restaurant.price_level)}</span>}
                                        </div>
                                        <p className="category">{Array.isArray(restaurant.categories) ? restaurant.categories[0] : restaurant.categories}</p>
                                    </div>
                                    <button
                                        className={`add - btn ${addedIds.has(restaurant._id) ? 'added' : ''} `}
                                        onClick={(e) => { e.stopPropagation(); handleAddRestaurant(restaurant); }}
                                    >
                                        {addedIds.has(restaurant._id) ? '✓' : '+'}
                                    </button>
                                </div>
                            ))}
                            {isLoadingRestaurants && <div className="loader">Loading...</div>}
                        </div>
                    </div>
                )}

                {activeSection === 'location' && (
                    <div className="places-section">
                        <div className="section-sticky-header">
                            <span className="section-icon">📍</span>
                            <h3>Search by Location</h3>
                        </div>
                        <div className="location-search-area">
                            <p className="hint">Click anywhere on the map to search around that location.</p>
                            {/* We can listen to map clicks and filter results here */}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
