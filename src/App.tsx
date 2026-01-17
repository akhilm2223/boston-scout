import { useState, useCallback } from 'react';
import Map3D from './components/Map3D';
import MapErrorBoundary from './components/MapErrorBoundary';
import ItineraryPanel from './components/ItineraryPanel';
import { ItineraryEvent } from './types';
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

  const [dates, setDates] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date(),
  });
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

  // Itinerary State
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
            <ItineraryPanel
              onLocationClick={handleLocationClick}
              customEvents={itineraryEvents}
                handleAddToItinerary={handleAddToItinerary}
              onRemoveEvent={handleRemoveFromItinerary}
            />
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
