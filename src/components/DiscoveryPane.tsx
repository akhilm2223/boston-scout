import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ItineraryEvent } from '../types';
import type { VectorSearchResult, EventSearchResult, HeroOption, UnifiedSearchResult } from '../types/vector';
import { useVectorSearch } from '../hooks/useVectorSearch';
import { useCityPulse } from '../hooks/useCityPulse';
import HeroOptions from './HeroOptions';
import VirtualDiscoveryList from './VirtualDiscoveryList';
import './DiscoveryPane.css';

export interface DiscoveryPaneRef {
  triggerSearch: (query: string) => void;
}

interface DiscoveryPaneProps {
  onAddToItinerary: (event: ItineraryEvent) => void;
  onLocationClick: (location: [number, number], name: string) => void;
  activeSearchQuery: string;
  onSearchStateChange?: (isSearching: boolean) => void;
}

/**
 * Discovery Pane with Vector Search and Virtual Scrolling
 *
 * Layout:
 * ┌─────────────────────────┐
 * │ Filters (rating/price)  │
 * ├─────────────────────────┤
 * │ Hero Options (4 picks)  │
 * ├─────────────────────────┤
 * │ Virtual Scrolling List  │
 * │ (react-window)          │
 * │                         │
 * └─────────────────────────┘
 */
const DiscoveryPane = forwardRef<DiscoveryPaneRef, DiscoveryPaneProps>(({
  onAddToItinerary,
  onLocationClick,
  activeSearchQuery,
  onSearchStateChange,
}, ref) => {
  // Track added place IDs
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [priceLevel, setPriceLevel] = useState<number | null>(null);

  // Vector search hook
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasMore,
    loadMore,
    search,
    searchType,
    setSearchType
  } = useVectorSearch({ debounceMs: 300, initialLimit: 20 });
  
  // Check if any filter is active
  const hasActiveFilters = minRating > 0 || priceLevel !== null || searchType !== 'places';

  // City pulse hook for hero options
  const {
    heroOptions,
    isLoading: isPulseLoading
  } = useCityPulse({ updateIntervalMs: 60000 });

  // Expose search function via ref
  useImperativeHandle(ref, () => ({
    triggerSearch: (searchQuery: string) => {
      if (searchQuery.trim()) {
        search(searchQuery);
      }
    }
  }), [search]);

  // Notify parent of search state changes
  useEffect(() => {
    onSearchStateChange?.(isLoading);
  }, [isLoading, onSearchStateChange]);

  // Sync with external search query
  useEffect(() => {
    if (activeSearchQuery && activeSearchQuery !== query) {
      setQuery(activeSearchQuery);
    }
  }, [activeSearchQuery, query, setQuery]);

  // Initial load - search for popular places
  useEffect(() => {
    if (results.length === 0 && !query) {
      search('popular restaurant boston');
    }
  }, [results.length, query, search]);

  // Filter results client-side
  const filteredResults = results.filter(item => {
    // Events don't have rating/price filters
    if (item.type === 'event') return true;
    // For places, apply filters
    const place = item as VectorSearchResult;
    if (minRating > 0 && (place.rating || 0) < minRating) return false;
    if (priceLevel !== null && place.price_level !== priceLevel) return false;
    return true;
  });

  /**
   * Handle hero option click
   */
  const handleHeroClick = useCallback((option: HeroOption) => {
    setSearchType('places');
    setQuery(option.query);
  }, [setQuery, setSearchType]);

  /**
   * Handle Events button click - switch to events search
   */
  const handleEventsClick = useCallback(() => {
    setSearchType('events');
    search('upcoming events boston');
  }, [setSearchType, search]);

  /**
   * Convert place or event to itinerary event and add
   */
  const handleAddItem = useCallback((item: UnifiedSearchResult) => {
    if (addedIds.has(item._id)) return;

    let event: ItineraryEvent;

    if (item.type === 'event') {
      const eventItem = item as EventSearchResult;
      event = {
        id: eventItem._id,
        name: eventItem.title,
        location: { lat: eventItem.venue.lat, lng: eventItem.venue.lng },
        time: eventItem.start_time,
        duration: '2 hours',
        vibe: eventItem.category || 'entertainment',
        sentiment: 'positive',
        category: 'event'
      };
    } else {
      const place = item as VectorSearchResult;
      event = {
        id: place._id,
        name: place.businessname,
        location: { lat: place.latitude, lng: place.longitude },
        time: '',
        duration: '1-2 hours',
        vibe: place.categories
          ? (typeof place.categories === 'string' ? place.categories : place.categories[0])
          : 'dining',
        sentiment: place.rating && place.rating >= 4.5 ? 'positive' : 'neutral',
        category: 'food'
      };
    }

    onAddToItinerary(event);
    setAddedIds(prev => new Set(prev).add(item._id));
  }, [addedIds, onAddToItinerary]);

  /**
   * Handle skip (just track for now, could be used for recommendations)
   */
  const handleSkipItem = useCallback((item: UnifiedSearchResult) => {
    // Could track skipped items for better recommendations
    const name = item.type === 'event' ? (item as EventSearchResult).title : (item as VectorSearchResult).businessname;
    console.log('Skipped:', name);
  }, []);

  /**
   * Handle item click - fly to location on map
   */
  const handleItemClick = useCallback((item: UnifiedSearchResult) => {
    if (item.type === 'event') {
      const event = item as EventSearchResult;
      if (event.venue.lng && event.venue.lat) {
        onLocationClick([event.venue.lng, event.venue.lat], event.title);
      }
    } else {
      const place = item as VectorSearchResult;
      if (place.longitude && place.latitude) {
        onLocationClick([place.longitude, place.latitude], place.businessname);
      }
    }
  }, [onLocationClick]);

  return (
    <div className="discovery-column">
      {/* Column Header with Filter Toggle */}
      <div className="column-header">
        <h2>Discover</h2>
        <button 
          className={`filter-toggle-btn ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <span className="filter-icon">⚙</span>
          {hasActiveFilters && <span className="filter-badge">{(minRating > 0 ? 1 : 0) + (priceLevel !== null ? 1 : 0)}</span>}
        </button>
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <div className="discovery-filters">
          {/* Search Type Filter */}
          <div className="filter-group">
            <label className="filter-label">Search In</label>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${searchType === 'places' ? 'active' : ''}`}
                onClick={() => setSearchType('places')}
              >
                🍽️ Places
              </button>
              <button
                className={`filter-btn ${searchType === 'events' ? 'active' : ''}`}
                onClick={() => setSearchType('events')}
              >
                🎭 Events
              </button>
              <button
                className={`filter-btn ${searchType === 'all' ? 'active' : ''}`}
                onClick={() => setSearchType('all')}
              >
                All
              </button>
            </div>
          </div>

          {/* Rating Filter - only for places */}
          {searchType !== 'events' && (
            <div className="filter-group">
              <label className="filter-label">Min Rating</label>
              <div className="filter-buttons">
                {[0, 3, 3.5, 4, 4.5].map((rating) => (
                  <button
                    key={rating}
                    className={`filter-btn ${minRating === rating ? 'active' : ''}`}
                    onClick={() => setMinRating(rating)}
                  >
                    {rating === 0 ? 'Any' : `${rating}★`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price Filter - only for places */}
          {searchType !== 'events' && (
            <div className="filter-group">
              <label className="filter-label">Price</label>
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${priceLevel === null ? 'active' : ''}`}
                  onClick={() => setPriceLevel(null)}
                >
                  Any
                </button>
                {[1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    className={`filter-btn ${priceLevel === level ? 'active' : ''}`}
                    onClick={() => setPriceLevel(level)}
                  >
                    {'$'.repeat(level)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button 
              className="clear-filters-btn"
              onClick={() => { setMinRating(0); setPriceLevel(null); setSearchType('places'); }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Hero Options */}
      <HeroOptions
        options={heroOptions}
        onOptionClick={handleHeroClick}
        onEventsClick={handleEventsClick}
        isLoading={isPulseLoading}
      />

      {/* Virtual Scrolling List */}
      <VirtualDiscoveryList
        items={filteredResults}
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={loadMore}
        addedIds={addedIds}
        onAddItem={handleAddItem}
        onSkipItem={handleSkipItem}
        onItemClick={handleItemClick}
        emptyMessage={error || 'Search for places and events to discover'}
      />
    </div>
  );
});

export default DiscoveryPane;
