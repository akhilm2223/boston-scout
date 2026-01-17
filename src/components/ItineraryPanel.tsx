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
  category: 'transit' | 'food' | 'attraction' | 'university';
}

interface ItineraryPanelProps {
  onLocationClick: (location: [number, number], name: string) => void;
}

const ITINERARY_DATA: ItineraryStop[] = [
  {
    id: 'wpi-start',
    name: 'WPI Campus',
    location: [-71.8023, 42.2626],
    time: '9:00 AM',
    duration: '30 min',
    vibe: 'Starting point - Worcester',
    sentiment: 'positive',
    category: 'university',
  },
  {
    id: 'commuter-rail',
    name: 'Worcester Line → Boston',
    location: [-71.4, 42.3],
    time: '9:30 AM',
    duration: '75 min',
    vibe: 'Express to Boston - scenic route',
    sentiment: 'positive',
    category: 'transit',
  },
  {
    id: 'back-bay',
    name: 'Back Bay Station',
    location: [-71.0752, 42.3478],
    time: '10:45 AM',
    duration: '10 min',
    vibe: 'Arrival - central Boston hub',
    sentiment: 'positive',
    category: 'transit',
  },
  {
    id: 'prudential',
    name: 'Prudential Center',
    location: [-71.0820, 42.3478],
    time: '11:00 AM',
    duration: '45 min',
    vibe: 'Skywalk views - parent-friendly',
    sentiment: 'positive',
    category: 'attraction',
  },
  {
    id: 'newbury',
    name: 'Newbury Street',
    location: [-71.0826, 42.3503],
    time: '12:00 PM',
    duration: '60 min',
    vibe: 'Shopping & cafes - upscale vibe',
    sentiment: 'positive',
    category: 'attraction',
  },
  {
    id: 'north-end',
    name: 'North End',
    location: [-71.0536, 42.3647],
    time: '1:30 PM',
    duration: '30 min',
    vibe: 'Historic Italian district',
    sentiment: 'positive',
    category: 'attraction',
  },
  {
    id: 'la-famiglia',
    name: "La Famiglia Giorgio's",
    location: [-71.0542, 42.3651],
    time: '2:00 PM',
    duration: '90 min',
    vibe: 'Massive portions - family staple',
    sentiment: 'positive',
    category: 'food',
  },
  {
    id: 'freedom-trail',
    name: 'Freedom Trail',
    location: [-71.0589, 42.3601],
    time: '4:00 PM',
    duration: '60 min',
    vibe: 'Historic walk - accessible',
    sentiment: 'positive',
    category: 'attraction',
  },
  {
    id: 'harvard',
    name: 'Harvard Square',
    location: [-71.1190, 42.3736],
    time: '5:30 PM',
    duration: '45 min',
    vibe: 'University atmosphere - bookstores',
    sentiment: 'positive',
    category: 'university',
  },
  {
    id: 'return',
    name: 'Return to WPI',
    location: [-71.8023, 42.2626],
    time: '7:00 PM',
    duration: '75 min',
    vibe: 'Worcester Line back',
    sentiment: 'neutral',
    category: 'transit',
  },
];

export default function ItineraryPanel({ onLocationClick }: ItineraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  const handleStopClick = (stop: ItineraryStop) => {
    setSelectedStop(stop.id);
    onLocationClick(stop.location, stop.name);
  };

  const filteredStops = ITINERARY_DATA.filter(stop =>
    stop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stop.vibe.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'transit': return '🚆';
      case 'food': return '🍝';
      case 'attraction': return '🏛️';
      case 'university': return '🎓';
      default: return '📍';
    }
  };

  return (
    <div className="itinerary-panel">
      <div className="itinerary-header">
        <h1 className="itinerary-title">MLK Weekend</h1>
        <p className="itinerary-subtitle">WPI Parent Visit • Boston Itinerary</p>
      </div>

      <div className="timeline-container">
        <div className="timeline-line" />
        
        {filteredStops.map((stop, index) => (
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
                <span className="stop-time">{stop.time}</span>
              </div>
              
              <div className="stop-details">
                <span className="stop-duration">{stop.duration}</span>
                <span className="stop-separator">•</span>
                <span className="stop-vibe">{stop.vibe}</span>
              </div>
              
              <div className={`sentiment-badge ${stop.sentiment}`}>
                {stop.sentiment === 'positive' ? '✓ Recommended' : 
                 stop.sentiment === 'warning' ? '⚠ Check timing' : 
                 'ℹ Info'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search locations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
    </div>
  );
}
