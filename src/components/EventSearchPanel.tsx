import { useState, useCallback } from 'react';
import { formatEventDate, formatEventTime } from '../services/eventsApi';
import { BostonEvent, ItineraryEvent, SearchResult } from '../types';
import './EventSearchPanel.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface EventSearchPanelProps {
    onAddToItinerary: (event: ItineraryEvent) => void;
    onLocationClick: (location: [number, number], name: string) => void;
}

export default function EventSearchPanel({ onAddToItinerary, onLocationClick }: EventSearchPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [addedEventIds, setAddedEventIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            setError('Please enter a search query');
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            // Build request body with optional date filter
            const requestBody: { query: string; startDate?: string; endDate?: string } = {
                query: searchQuery
            };

            if (selectedDate) {
                // Set date range for the selected day (start of day to end of day)
                const startOfDay = new Date(selectedDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(selectedDate);
                endOfDay.setHours(23, 59, 59, 999);

                requestBody.startDate = startOfDay.toISOString();
                requestBody.endDate = endOfDay.toISOString();
            }

            const response = await fetch(`${API_BASE_URL}/api/events/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const result: SearchResult = await response.json();
            setSearchResult(result);
        } catch (err) {
            console.error('Search error:', err);
            setError('Failed to search events. Please check if the server is running.');
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, selectedDate]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleAddToItinerary = (event: BostonEvent) => {
        const itineraryEvent: ItineraryEvent = {
            id: event._id,
            name: event.title,
            location: [event.venue.lng, event.venue.lat],
            time: formatEventTime(event.start_time),
            duration: calculateDuration(event.start_time, event.end_time),
            vibe: event.venue.name,
            sentiment: 'positive',
            category: 'event',
            eventData: event
        };

        onAddToItinerary(itineraryEvent);
        setAddedEventIds(prev => new Set(prev).add(event._id));
    };

    const handleEventClick = (event: BostonEvent) => {
        if (event.venue?.lat && event.venue?.lng) {
            onLocationClick([event.venue.lng, event.venue.lat], event.title);
        }
    };

    const calculateDuration = (start: string, end: string): string => {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        const hours = Math.round((endTime - startTime) / (1000 * 60 * 60));
        if (hours < 1) return '~1 hour';
        if (hours === 1) return '1 hour';
        return `${hours} hours`;
    };

    const getCategoryEmoji = (categories?: string[]): string => {
        if (!categories || categories.length === 0) return '📅';
        const cat = categories[0]?.toLowerCase() || '';
        if (cat.includes('music') || cat.includes('concert')) return '🎵';
        if (cat.includes('sport')) return '⚽';
        if (cat.includes('art') || cat.includes('museum')) return '🎨';
        if (cat.includes('food') || cat.includes('dining')) return '🍴';
        if (cat.includes('comedy')) return '😂';
        if (cat.includes('family') || cat.includes('kid')) return '👨‍👩‍👧';
        if (cat.includes('outdoor') || cat.includes('nature')) return '🌳';
        if (cat.includes('tech') || cat.includes('conference')) return '💻';
        if (cat.includes('wellness') || cat.includes('fitness')) return '🧘';
        return '📅';
    };

    return (
        <div className="event-search-panel">
            {/* Search Results Area */}
            <div className="search-results-area">
                {error && (
                    <div className="search-error">
                        <span>⚠️</span> {error}
                    </div>
                )}

                {searchResult && searchResult.events.length > 0 && (
                    <div className="events-list">
                        {searchResult.events.map(event => (
                            <div
                                key={event._id}
                                className={`event-card ${addedEventIds.has(event._id) ? 'added' : ''}`}
                                onClick={() => handleEventClick(event)}
                            >
                                <div className="event-emoji">{getCategoryEmoji(event.categories)}</div>
                                <div className="event-info">
                                    <h3 className="event-title">{event.title}</h3>
                                    <div className="event-meta">
                                        <span className="event-date">{formatEventDate(event.start_time)}</span>
                                        <span className="event-separator">•</span>
                                        <span className="event-time">{formatEventTime(event.start_time)}</span>
                                    </div>
                                    <p className="event-venue">{event.venue?.name}</p>
                                </div>
                                <button
                                    className={`add-button ${addedEventIds.has(event._id) ? 'added' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddToItinerary(event);
                                    }}
                                    disabled={addedEventIds.has(event._id)}
                                    title={addedEventIds.has(event._id) ? 'Added to itinerary' : 'Add to itinerary'}
                                >
                                    {addedEventIds.has(event._id) ? '✓' : '+'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {searchResult && searchResult.events.length === 0 && (
                    <div className="no-results">
                        <span className="no-results-icon">🔍</span>
                        <p>No events found</p>
                    </div>
                )}

                {!searchResult && !error && (
                    <div className="empty-state">
                        <span className="empty-icon">✨</span>
                        <p>Search for events using AI</p>
                        <p className="empty-hint">Try "live music" or "family activities"</p>
                    </div>
                )}
            </div>

            {/* Search Bar at Bottom */}
            <div className="search-bar-container">
                <div className="search-row">
                    <input
                        type="text"
                        className="search-input"
                        placeholder='Search events... (e.g. "jazz")'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    <button
                        className={`search-button ${isSearching ? 'searching' : ''}`}
                        onClick={handleSearch}
                        disabled={isSearching}
                    >
                        {isSearching ? <span className="spinner"></span> : '🔍'}
                    </button>
                </div>
                <div className="date-row">
                    <label className="date-label">📅 Date:</label>
                    <input
                        type="date"
                        className="date-input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    {selectedDate && (
                        <button
                            className="clear-date-btn"
                            onClick={() => setSelectedDate('')}
                            title="Clear date"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
