import { useState } from 'react';
import './ItineraryPanel.css';

interface ItineraryStop {
  id: string;
  name: string;
  location: [number, number]; // [lng, lat]
  time: string;
  duration: string;
  vibe: string;
  sentiment: 'positive' | 'neutral' | 'warning';
  category: 'transit' | 'food' | 'attraction' | 'university' | 'event';
  isCustom?: boolean;
}

interface ItineraryPanelProps {
  onLocationClick: (location: [number, number], name: string) => void;
  customEvents?: ItineraryStop[];
  onRemoveEvent?: (eventId: string) => void;
}

export default function ItineraryPanel({ onLocationClick, customEvents = [], onRemoveEvent }: ItineraryPanelProps) {
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  const handleStopClick = (stop: ItineraryStop) => {
    setSelectedStop(stop.id);
    onLocationClick(stop.location, stop.name);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'transit': return '🚆';
      case 'food': return '🍝';
      case 'attraction': return '🏛️';
      case 'university': return '🎓';
      case 'event': return '🎫';
      default: return '📍';
    }
  };

  // Only show custom events (events added from search)
  const allStops = customEvents.map(e => ({ ...e, isCustom: true }));

  if (allStops.length === 0) {
    return (
      <div className="itinerary-panel">
        <div className="empty-itinerary">
          <span className="empty-icon">📋</span>
          <p>No events yet</p>
          <p className="empty-hint">Search and add events →</p>
        </div>
      </div>
    );
  }

  return (
    <div className="itinerary-panel">
      <div className="timeline-container">
        <div className="timeline-line" />

        {allStops.map((stop) => (
          <div
            key={stop.id}
            className={`timeline-stop ${selectedStop === stop.id ? 'selected' : ''} ${stop.sentiment}`}
            onClick={() => handleStopClick(stop)}
          >
            <div className="timeline-dot">
              <span className="timeline-icon">{getCategoryIcon(stop.category)}</span>
            </div>

            <div className="timeline-content">
              <div className="stop-header">
                <h3 className="stop-name">{stop.name}</h3>
                {onRemoveEvent && (
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveEvent(stop.id);
                    }}
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="stop-details">
                <span className="stop-time">{stop.time}</span>
                <span className="stop-separator">•</span>
                <span className="stop-vibe">{stop.vibe}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Build Train Schedule Button */}
      <div className="build-schedule-container">
        <button className="build-schedule-btn" disabled={allStops.length === 0}>
          🚆 Build Train Schedule
        </button>
      </div>
    </div>
  );
}
