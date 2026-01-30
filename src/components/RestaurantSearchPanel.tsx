import { useState, useCallback, useEffect } from 'react';
import { ItineraryEvent } from '../types';
import './RestaurantSearchPanel.css';
import { Restaurant } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface RestaurantSearchPanelProps {
    onAddToItinerary: (event: ItineraryEvent) => void;
    onLocationClick: (location: [number, number], name: string) => void;
}

export default function RestaurantSearchPanel({ onAddToItinerary, onLocationClick }: RestaurantSearchPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [minRating, setMinRating] = useState<number>(0);
    const [priceLevel, setPriceLevel] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Fetch all restaurants on mount
    useEffect(() => {
        fetchRestaurants();
    }, []);

    const fetchRestaurants = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/restaurants`);
            if (!response.ok) throw new Error('Failed to fetch restaurants');
            const data = await response.json();
            setRestaurants(data);
            setFilteredRestaurants(data);
        } catch (err) {
            console.error('Error fetching restaurants:', err);
            setError('Failed to load restaurants. Please check if the server is running.');
        } finally {
            setIsLoading(false);
        }
    };

    // Filter restaurants based on search and filters
    useEffect(() => {
        let filtered = [...restaurants];

        // Text search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r => {
                const categoriesStr = Array.isArray(r.categories) ? r.categories.join(' ') : (r.categories || '');
                return r.businessname?.toLowerCase().includes(query) ||
                    categoriesStr.toLowerCase().includes(query) ||
                    r.address?.toLowerCase().includes(query);
            });
        }

        // Rating filter
        if (minRating > 0) {
            filtered = filtered.filter(r => (r.rating || 0) >= minRating);
        }

        // Price level filter
        if (priceLevel !== null) {
            filtered = filtered.filter(r => r.price_level === priceLevel);
        }

        setFilteredRestaurants(filtered);
    }, [searchQuery, restaurants, minRating, priceLevel]);

    const handleAddToItinerary = useCallback((restaurant: Restaurant) => {
        const categoriesStr = Array.isArray(restaurant.categories)
            ? restaurant.categories.join(', ')
            : (restaurant.categories || 'Restaurant');

        const itineraryEvent: ItineraryEvent = {
            id: `restaurant-${restaurant._id}`,
            name: restaurant.businessname || 'Unknown Restaurant',
            location: { lat: Number(restaurant.latitude), lng: Number(restaurant.longitude) },
            time: 'Flexible',
            duration: '~1 hour',
            vibe: categoriesStr,
            sentiment: 'positive',
            category: 'food',
        };

        onAddToItinerary(itineraryEvent);
        setAddedIds(prev => new Set(prev).add(restaurant._id));
    }, [onAddToItinerary]);

    const handleRestaurantClick = (restaurant: Restaurant) => {
        if (restaurant.latitude && restaurant.longitude) {
            onLocationClick([restaurant.longitude, restaurant.latitude], restaurant.businessname);
        }
    };

    const getPriceLabel = (level?: number): string => {
        if (!level) return '';
        return '$'.repeat(level);
    };

    const getCategoryEmoji = (categories?: string | string[]): string => {
        if (!categories) return '🍽️';
        const cat = Array.isArray(categories)
            ? categories.join(' ').toLowerCase()
            : categories.toLowerCase();

        if (cat.includes('pizza')) return '🍕';
        if (cat.includes('burger') || cat.includes('american')) return '🍔';
        if (cat.includes('sushi') || cat.includes('japanese')) return '🍣';
        if (cat.includes('chinese')) return '🥡';
        if (cat.includes('mexican') || cat.includes('taco')) return '🌮';
        if (cat.includes('italian') || cat.includes('pasta')) return '🍝';
        if (cat.includes('indian')) return '🍛';
        if (cat.includes('thai')) return '🍜';
        if (cat.includes('seafood') || cat.includes('fish')) return '🦐';
        if (cat.includes('steakhouse') || cat.includes('steak')) return '🥩';
        if (cat.includes('coffee') || cat.includes('cafe')) return '☕';
        if (cat.includes('bakery') || cat.includes('dessert')) return '🧁';
        if (cat.includes('bar') || cat.includes('pub')) return '🍺';
        if (cat.includes('breakfast') || cat.includes('brunch')) return '🥞';
        if (cat.includes('vegetarian') || cat.includes('vegan')) return '🥗';
        return '🍽️';
    };

    const renderStars = (rating?: any) => {
        const numRating = Number(rating);
        if (isNaN(numRating) || numRating <= 0) return null;

        const fullStars = Math.floor(numRating);
        const hasHalf = numRating % 1 >= 0.5;

        return (
            <span className="star-rating">
                {'★'.repeat(fullStars)}
                {hasHalf && '½'}
                <span className="rating-number">{numRating.toFixed(1)}</span>
            </span>
        );
    };

    return (
        <div className="restaurant-search-panel">
            {/* Restaurant List */}
            <div className="restaurant-results-area">
                {error && (
                    <div className="search-error">
                        <span>⚠️</span> {error}
                    </div>
                )}

                {isLoading && (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading restaurants...</p>
                    </div>
                )}

                {!isLoading && filteredRestaurants.length > 0 && (
                    <div className="restaurants-list">
                        {filteredRestaurants.slice(0, 50).map(restaurant => (
                            <div
                                key={restaurant._id}
                                className={`restaurant-card ${addedIds.has(restaurant._id) ? 'added' : ''}`}
                                onClick={() => handleRestaurantClick(restaurant)}
                            >
                                <div className="restaurant-emoji">{getCategoryEmoji(restaurant.categories)}</div>
                                <div className="restaurant-info">
                                    <h3 className="restaurant-name">{restaurant.businessname}</h3>
                                    <div className="restaurant-meta">
                                        {renderStars(restaurant.rating)}
                                        {restaurant.user_rating_count && (
                                            <span className="review-count">({restaurant.user_rating_count})</span>
                                        )}
                                        {restaurant.price_level && (
                                            <>
                                                <span className="meta-separator">•</span>
                                                <span className="price-level">{getPriceLabel(restaurant.price_level)}</span>
                                            </>
                                        )}
                                    </div>
                                    <p className="restaurant-category">
                                        {Array.isArray(restaurant.categories)
                                            ? restaurant.categories.join(', ')
                                            : (restaurant.categories || 'Restaurant')}
                                    </p>
                                </div>
                                <button
                                    className={`add-button ${addedIds.has(restaurant._id) ? 'added' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddToItinerary(restaurant);
                                    }}
                                    disabled={addedIds.has(restaurant._id)}
                                    title={addedIds.has(restaurant._id) ? 'Added to itinerary' : 'Add to itinerary'}
                                >
                                    {addedIds.has(restaurant._id) ? '✓' : '+'}
                                </button>
                            </div>
                        ))}
                        {filteredRestaurants.length > 50 && (
                            <p className="results-hint">
                                Showing 50 of {filteredRestaurants.length} restaurants. Use search to narrow down.
                            </p>
                        )}
                    </div>
                )}

                {!isLoading && filteredRestaurants.length === 0 && !error && (
                    <div className="no-results">
                        <span className="no-results-icon">🍽️</span>
                        <p>No restaurants found</p>
                        <p className="empty-hint">Try adjusting your filters</p>
                    </div>
                )}
            </div>

            {/* Search and Filters */}
            <div className="search-bar-container">
                <div className="search-row">
                    <input
                        type="text"
                        className="search-input"
                        placeholder='Search restaurants... (e.g. "pizza", "sushi")'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                        className="filter-toggle-btn"
                        onClick={() => setShowFilters(!showFilters)}
                        title="Toggle filters"
                    >
                        {showFilters ? '✕' : '⚙️'}
                    </button>
                </div>

                {showFilters && (
                    <div className="filters-row">
                        <div className="filter-group">
                            <label>Min Rating:</label>
                            <select
                                value={minRating}
                                onChange={(e) => setMinRating(Number(e.target.value))}
                                className="filter-select"
                            >
                                <option value={0}>Any</option>
                                <option value={3}>3+ ★</option>
                                <option value={4}>4+ ★</option>
                                <option value={4.5}>4.5+ ★</option>
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Price:</label>
                            <select
                                value={priceLevel ?? ''}
                                onChange={(e) => setPriceLevel(e.target.value ? Number(e.target.value) : null)}
                                className="filter-select"
                            >
                                <option value="">Any</option>
                                <option value={1}>$</option>
                                <option value={2}>$$</option>
                                <option value={3}>$$$</option>
                                <option value={4}>$$$$</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
