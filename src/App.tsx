import { useState, useCallback } from 'react';
import Map3D from './components/Map3D';
import MapErrorBoundary from './components/MapErrorBoundary';
import ItineraryPanel from './components/ItineraryPanel';
import EventSearchPanel, { ItineraryEvent } from './components/EventSearchPanel';
import RestaurantSearchPanel from './components/RestaurantSearchPanel';
import './App.css';

export interface CitySettings {
  timeOfDay: number;
  weather: 'clear' | 'rain' | 'snow' | 'fog';
  fogDensity: number;
  buildingGlow: number;
  trafficDensity: number;
  cameraMode: 'free' | 'helicopter' | 'street' | 'drone' | 'cinematic';
  showTransit: boolean;
  showStreetLights: boolean;
  glitchEffect: boolean;
  neonMode: boolean;
}

function App() {
  const [settings] = useState<CitySettings>({
    timeOfDay: 20,
    weather: 'clear',
    fogDensity: 0.5,
    buildingGlow: 0.8,
    trafficDensity: 0.6,
    cameraMode: 'free',
    showTransit: true,
    showStreetLights: true,
    glitchEffect: false,
    neonMode: true,
  });

  const [selectedLocation, setSelectedLocation] = useState<{
    location: [number, number];
    name: string;
  } | null>(null);

  // Search State
  const [itineraryEvents, setItineraryEvents] = useState<ItineraryEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      setActiveSearchQuery(searchQuery);
      setIsSearching(true);
      // Reset searching state after a timeout to simulate loading "handoff"
      setTimeout(() => setIsSearching(false), 1000);
    }
  }, [searchQuery]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchSubmit();
  };

  const handleLocationClick = useCallback((location: [number, number], name: string) => {
    setSelectedLocation({ location, name });
  }, []);

  const handleAddToItinerary = useCallback((event: ItineraryEvent) => {
    setItineraryEvents(prev => {
      if (prev.some(e => e.id === event.id)) return prev;
      return [...prev, event];
    });
  }, []);

  const handleRemoveFromItinerary = useCallback((eventId: string) => {
    setItineraryEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  return (
    <div className="app">
      {/* Left Panel: Results + Itinerary Side by Side */}
      <div className="app-left-panel">
        <div className="dual-panel-container">
          {/* Discovery Column (4-Card Grid) */}
          <div className="discovery-column">
            <EventSearchPanel
              onAddToItinerary={handleAddToItinerary}
              onLocationClick={handleLocationClick}
              activeSearchQuery={activeSearchQuery}
            />
          </div>

          {/* Itinerary Column */}
          <div className="itinerary-column">
            <div className="column-header">
              <h2>Your Itinerary</h2>
            </div>
            <ItineraryPanel
              onLocationClick={handleLocationClick}
              customEvents={itineraryEvents}
              onRemoveEvent={handleRemoveFromItinerary}
            />
          </div>
        </div>

        {/* Unified Search Bar */}
        <div className="global-search-container">
          <div className="search-wrapper">
            <input
              type="text"
              className="global-search-input"
              placeholder="Ask for experiences... (e.g. 'romantic dinner' or 'jazz concert')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button
              className="global-search-btn"
              onClick={handleSearchSubmit}
              disabled={isSearching}
            >
              {isSearching ? '...' : '→'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: 3D Map */}
      <div className="app-right-panel">
        <MapErrorBoundary>
          <Map3D
            settings={settings}
            selectedLocation={selectedLocation}
          />
        </MapErrorBoundary>
      </div>
    </div>
  );
}

export default App;
