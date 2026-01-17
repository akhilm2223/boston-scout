import { useState, useCallback, useEffect } from 'react';
import { BostonEvent, formatEventDate, formatEventTime } from '../services/eventsApi';
import './EventSearchPanel.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ItineraryEvent {
    id: string;
    name: string;
    location: [number, number];
    time: string;
    duration: string;
    vibe: string;
    sentiment: 'positive' | 'neutral' | 'warning';
    category: 'transit' | 'food' | 'attraction' | 'university' | 'event';
    eventData?: BostonEvent;
}

export interface EventSearchPanelProps {
    onAddToItinerary: (event: ItineraryEvent) => void;
    onLocationClick: (location: [number, number], name: string) => void;
    activeSearchQuery?: string;
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

// Placeholder images for events without images
const PLACEHOLDER_IMAGES = [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=300&fit=crop',
];

export default function EventSearchPanel({ onAddToItinerary, onLocationClick, activeSearchQuery }: EventSearchPanelProps) {
    const [isSearching, setIsSearching] = useState(false);
    const [allEvents, setAllEvents] = useState<BostonEvent[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedCardIndex, setSelectedCardIndex] = useState(0);
    const [addedEventIds, setAddedEventIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState<BostonEvent | null>(null);

    const CARDS_PER_PAGE = 24;
    const currentEvents = allEvents.slice(currentPage * CARDS_PER_PAGE, (currentPage + 1) * CARDS_PER_PAGE);
    const totalPages = Math.ceil(allEvents.length / CARDS_PER_PAGE);

    // Initial load
    useEffect(() => {
        handleSearch('events in boston');
    }, []);

    // Handle external search
    useEffect(() => {
        if (activeSearchQuery) {
            handleSearch(activeSearchQuery);
        }
    }, [activeSearchQuery]);

    const handleSearch = useCallback(async (query: string) => {
        setIsSearching(true);
        setError(null);

        try {
            const requestBody: { query: string } = {
                query: query
            };

            const response = await fetch(`${API_BASE_URL}/api/events/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const result: SearchResult = await response.json();
            setAllEvents(result.events);
            setCurrentPage(0);
            setSelectedCardIndex(0);
        } catch (err) {
            console.error('Search error:', err);
            setError('Failed to load events');
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSkip = () => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(prev => prev + 1);
            setSelectedCardIndex(0);
        } else {
            // Wrap to beginning
            setCurrentPage(0);
            setSelectedCardIndex(0);
        }
    };

    const handleShowSimilar = () => {
        const selectedEvent = currentEvents[selectedCardIndex];
        if (selectedEvent?.categories?.[0]) {
            handleSearch(selectedEvent.categories[0]);
        }
    };

    const handleAddToItinerary = () => {
        const event = currentEvents[selectedCardIndex];
        if (!event || addedEventIds.has(event._id)) return;

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

    const handleSeeDetails = () => {
        const event = currentEvents[selectedCardIndex];
        if (event) {
            setShowDetails(event);
        }
    };

    const handleCardClick = (index: number, event: BostonEvent) => {
        setSelectedCardIndex(index);
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

    const getEventImage = (event: BostonEvent, index: number): string => {
        if (event.image_url) return event.image_url;
        return PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
    };

    const selectedEvent = currentEvents[selectedCardIndex];
    const isSelectedAdded = selectedEvent && addedEventIds.has(selectedEvent._id);

    return (
        <div className="discovery-panel">
            {/* 4-Card Grid */}
            <div className="cards-grid">
                {currentEvents.length > 0 ? (
                    currentEvents.map((event, index) => (
                        <div
                            key={event._id}
                            className={`event-card-v2 ${selectedCardIndex === index ? 'selected' : ''} ${addedEventIds.has(event._id) ? 'added' : ''}`}
                            onClick={() => handleCardClick(index, event)}
                            style={{
                                '--event-image': `url(${getEventImage(event, index)})`
                            } as React.CSSProperties}
                        >
                            {/* Simple Action Buttons on Card */}
                            <div className="card-actions">
                                <button
                                    className="card-action-btn accept"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!addedEventIds.has(event._id)) {
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
                                        }
                                    }}
                                    disabled={addedEventIds.has(event._id)}
                                    title="Add to itinerary"
                                >
                                    {addedEventIds.has(event._id) ? 'Added' : 'Add to Itinerary'}
                                </button>
                            </div>

                            {addedEventIds.has(event._id) && (
                                <div className="card-added-badge">✓ Added</div>
                            )}
                            <div className="card-content">
                                <h3 className="card-title">{event.title}</h3>
                                <p className="card-venue">{event.venue?.name}</p>
                                <p className="card-date">
                                    {formatEventDate(event.start_time)} • {formatEventTime(event.start_time)}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-grid">
                        {isSearching ? (
                            <div className="loading-state">
                                <div className="spinner-large"></div>
                                <p>Discovering experiences...</p>
                            </div>
                        ) : (
                            <div className="empty-state-v2">
                                <span className="empty-icon">✨</span>
                                <p>Search for experiences</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Page Indicator */}
            {totalPages > 1 && (
                <div className="page-indicator">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
                        <button
                            key={i}
                            className={`page-dot ${currentPage === i ? 'active' : ''}`}
                            onClick={() => { setCurrentPage(i); setSelectedCardIndex(0); }}
                        />
                    ))}
                    {totalPages > 10 && <span className="more-pages">+{totalPages - 10}</span>}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="error-toast">
                    <span>⚠️</span> {error}
                </div>
            )}
        </div>
    );
}
