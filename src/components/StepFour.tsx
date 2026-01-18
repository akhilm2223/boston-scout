import { useState, useEffect } from 'react';
import { ItineraryEvent } from '../types/types';
import { optimizeItinerary } from '../services/geminiApi';

interface StepFourProps {
    items: ItineraryEvent[];
    tripDates: any;
    onBack?: () => void;
}

export default function StepFour({ items, tripDates, onBack }: StepFourProps) {
    const [optimizedPlan, setOptimizedPlan] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
    const [selectedHotel, setSelectedHotel] = useState<any>(null);
    const [hotels, setHotels] = useState<any[]>([]);
    const [hotelsLoading, setHotelsLoading] = useState(false);
    const [hotelsError, setHotelsError] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState(0); // For multi-day tab selection

    // Check if trip is multi-day
    const isMultiDay = tripDates?.startDate && tripDates?.endDate &&
        new Date(tripDates.endDate).getTime() - new Date(tripDates.startDate).getTime() > 0;

    useEffect(() => {
        // Try to get user location on mount
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log("Geolocation error or denied:", error);
                }
            );
        }

        // Fetch hotels if multi-day trip
        if (isMultiDay) {
            setHotelsLoading(true);
            setHotelsError(null);

            fetch('http://localhost:3000/api/hotels')
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    console.log('[Hotels] Fetched:', data.length, 'hotels');
                    setHotels(data.slice(0, 20));
                    setHotelsLoading(false);
                })
                .catch(err => {
                    console.error('Error fetching hotels:', err);
                    setHotelsError('Failed to load hotels. Make sure the server is running.');
                    setHotelsLoading(false);
                });
        }
    }, [isMultiDay]);

    const generatePlan = async () => {
        if (items.length === 0) {
            setOptimizedPlan("Your itinerary is empty. Please add some events in Step 3.");
            setLoading(false);
            return;
        }

        // Validate hotel selection for multi-day trips
        if (isMultiDay && !selectedHotel) {
            setOptimizedPlan(JSON.stringify({
                error: "Please select a hotel for your multi-day trip before generating the itinerary."
            }));
            setLoading(false);
            return;
        }

        setLoading(true);
        setSelectedDay(0); // Reset to first day when generating new itinerary
        const plan = await optimizeItinerary(items, tripDates, userLocation, selectedHotel);
        setOptimizedPlan(plan);
        setLoading(false);
    };

    useEffect(() => {
        generatePlan();
    }, [items, tripDates, userLocation, selectedHotel]);

    return (
        <div className="w-full h-full p-4 text-(--text-primary) flex flex-col overflow-hidden">
            <h2 className="text-xl font-bold mb-4 flex-shrink-0">Optimized Transit Itinerary</h2>

            {/* Hotel Selector for Multi-Day Trips */}
            {isMultiDay && (
                <div className="mb-4 p-5 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                        <label className="block text-base font-bold text-gray-900">
                            Select Your Hotel
                        </label>
                        <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-1 rounded">Required</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                        For your {Math.ceil((new Date(tripDates.endDate).getTime() - new Date(tripDates.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1}-day trip, we'll organize your schedule to return to your hotel each evening.
                    </p>

                    {hotelsError ? (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600 mb-2">Failed to load hotels. {hotelsError}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="text-xs text-red-700 underline hover:no-underline"
                            >
                                Reload Page
                            </button>
                        </div>
                    ) : hotelsLoading ? (
                        <div className="flex items-center gap-2 p-4 bg-white rounded-lg border border-gray-200">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <span className="text-sm text-gray-600">Loading hotels...</span>
                        </div>
                    ) : hotels.length > 0 ? (
                        <>
                            <select
                                className="w-full p-3 rounded-lg border-2 border-gray-300 bg-white text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                                value={selectedHotel?.name || ''}
                                onChange={(e) => {
                                    const hotel = hotels.find(h => h.name === e.target.value);
                                    setSelectedHotel(hotel);
                                }}
                            >
                                <option value="">Choose your hotel...</option>
                                {hotels.map((hotel, idx) => (
                                    <option key={idx} value={hotel.name}>
                                        {hotel.name} {hotel.rating ? `⭐ ${hotel.rating}/5` : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedHotel && (
                                <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                    <p className="text-sm font-medium text-gray-900">{selectedHotel.name}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {selectedHotel.address || 'Address not available'}
                                    </p>
                                    {selectedHotel.rating && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            ⭐ {selectedHotel.rating}/5 rating
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-700">No hotels found. Please check your database.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Info for single-day trips */}
            {!isMultiDay && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">
                        This is a single-day trip. Hotel selection is only needed for multi-day trips.
                    </p>
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--accent)"></div>
                    <p className="text-(--text-secondary)">Generating optimized schedule with public transit...</p>
                </div>
            ) : (
                <div className="flex-1 overflow-auto bg-(--bg-secondary) p-6 rounded-lg shadow-inner">
                    {(() => {
                        try {
                            const parsed = JSON.parse(optimizedPlan);
                            if (parsed.error) {
                                return <div className="text-red-500 font-medium">{parsed.error}</div>;
                            }

                            // Helper to clean details
                            const cleanDetails = (text: string) => {
                                if (!text) return '';
                                return text.replace(/\([\d.-]+,?\s*[\d.-]+\)/g, '').replace(/\s+/g, ' ').trim();
                            };

                            // Helper to render a schedule timeline
                            const renderSchedule = (schedule: any[], isMultiDay: boolean = false) => (
                                <div className="relative space-y-1">
                                    {schedule.map((step: any, idx: number) => {
                                        const isLast = idx === schedule.length - 1;
                                        const isTransit = step.type === 'transit';

                                        return (
                                            <div key={idx} className={`flex gap-6 relative ${isTransit ? 'py-2' : 'py-4'}`}>
                                                {/* Time Column */}
                                                <div className="w-20 flex-shrink-0 flex flex-col items-end pt-1">
                                                    {!isTransit && (
                                                        <span className="text-xs font-semibold text-gray-900 tracking-tight">
                                                            {step.time}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Timeline Track */}
                                                <div className="relative flex flex-col items-center w-1">
                                                    {!isLast && (
                                                        <div className="absolute top-3 bottom-0 left-1/2 w-px bg-gray-200"></div>
                                                    )}
                                                    {!isTransit && (
                                                        <div className="relative z-10 w-2 h-2 rounded-full bg-gray-900 mt-1"></div>
                                                    )}
                                                </div>

                                                {/* Content Column */}
                                                <div className="flex-1 min-w-0">
                                                    {isTransit ? (
                                                        <div className="flex items-start gap-3 py-1">
                                                            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                                                <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-baseline gap-2 flex-wrap">
                                                                    <span className="text-xs font-medium text-gray-900">
                                                                        {step.route_info || step.transport_mode || 'Transit'}
                                                                    </span>
                                                                    {step.boarding_time && (
                                                                        <span className="text-xs font-semibold text-blue-600">
                                                                            Board at {step.boarding_time}
                                                                        </span>
                                                                    )}
                                                                    {step.duration && (
                                                                        <span className="text-[11px] text-gray-400">
                                                                            {step.duration}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {step.details && (
                                                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                                        {cleanDetails(step.details)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <h3 className="text-base font-semibold text-gray-900 leading-tight mb-1.5">
                                                                {step.description}
                                                            </h3>
                                                            <div className="inline-flex items-center text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                                                                {step.type === 'meal' ? 'Meal' : step.type === 'hotel' ? 'Hotel' : 'Visit'}
                                                            </div>
                                                            {step.details && cleanDetails(step.details) && (
                                                                <p className="text-sm text-gray-600 leading-relaxed">
                                                                    {cleanDetails(step.details)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );

                            // Multi-day itinerary
                            if (parsed.days && Array.isArray(parsed.days)) {
                                return (
                                    <div className="space-y-4">
                                        {/* Day Tabs */}
                                        <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                                            {parsed.days.map((day: any, dayIdx: number) => (
                                                <button
                                                    key={dayIdx}
                                                    onClick={() => setSelectedDay(dayIdx)}
                                                    className={`px-4 py-2 rounded-t-lg font-medium transition ${selectedDay === dayIdx
                                                        ? 'bg-gray-900 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    Day {day.day}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Selected Day Content */}
                                        {parsed.days[selectedDay] && (
                                            <div className="space-y-2">
                                                {/* Day Header */}
                                                <div className="border-b border-gray-200 pb-2">
                                                    <h3 className="text-lg font-bold text-gray-900">
                                                        Day {parsed.days[selectedDay].day}
                                                    </h3>
                                                    {parsed.days[selectedDay].date && (
                                                        <p className="text-sm text-gray-500">{parsed.days[selectedDay].date}</p>
                                                    )}
                                                </div>
                                                {/* Day Schedule */}
                                                {parsed.days[selectedDay].schedule && Array.isArray(parsed.days[selectedDay].schedule) &&
                                                    renderSchedule(parsed.days[selectedDay].schedule, true)}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            // Single-day itinerary
                            if (parsed.schedule && Array.isArray(parsed.schedule)) {
                                return renderSchedule(parsed.schedule);
                            }

                            // Fallback - show user-friendly message instead of raw JSON
                            return (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 mb-2">Unable to parse itinerary format</p>
                                    <p className="text-xs text-gray-400">Please try regenerating the itinerary</p>
                                </div>
                            );
                        } catch (e) {
                            return (
                                <div className="text-center py-8">
                                    <p className="text-red-500 mb-2">Error loading itinerary</p>
                                    <p className="text-xs text-gray-400">Please try regenerating</p>
                                </div>
                            );
                        }
                    })()}
                </div>
            )}

            <div className="flex gap-3 mt-4 self-start">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="px-4 py-2 bg-(--bg-secondary) text-(--text-primary) border border-(--border-primary) rounded hover:bg-(--bg-hover) transition-colors duration-300"
                    >
                        Back to Edit
                    </button>
                )}
                <button
                    onClick={generatePlan}
                    disabled={loading}
                    className="px-4 py-2 bg-(--accent) text-(--text-inverse) rounded hover:bg-(--accent-hover) transition-colors duration-300 disabled:opacity-50"
                >
                    {loading ? 'Generating...' : 'Regenerate Itinerary'}
                </button>
            </div>
        </div>
    );
}
