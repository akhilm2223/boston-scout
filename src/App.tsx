import { useState, useCallback } from 'react';
import Map3D from './components/Map3D';
import MapErrorBoundary from './components/MapErrorBoundary';
import ItineraryPanel from './components/ItineraryPanel';
import EventSearchPanel, { ItineraryEvent } from './components/EventSearchPanel';
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

  const [itineraryEvents, setItineraryEvents] = useState<ItineraryEvent[]>([]);

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
          {/* Results Column */}
          <div className="results-column">
            <div className="column-header">
              <span className="header-icon">🔍</span>
              <h2>Results</h2>
            </div>
            <EventSearchPanel
              onAddToItinerary={handleAddToItinerary}
              onLocationClick={handleLocationClick}
            />
          </div>

          {/* Itinerary Column */}
          <div className="itinerary-column">
            <div className="column-header">
              <span className="header-icon">📋</span>
              <h2>Itinerary</h2>
              {itineraryEvents.length > 0 && (
                <span className="event-count">{itineraryEvents.length}</span>
              )}
            </div>
            <ItineraryPanel
              onLocationClick={handleLocationClick}
              customEvents={itineraryEvents}
              onRemoveEvent={handleRemoveFromItinerary}
            />
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
