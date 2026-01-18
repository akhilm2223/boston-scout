import { useState, useCallback, useEffect } from 'react';
import Map3D from './components/Map3D';
import MapErrorBoundary from './components/MapErrorBoundary';
import ItineraryPanel from './components/ItineraryPanel';
import EventSearchPanel, { ItineraryEvent } from './components/EventSearchPanel';
import WelcomeScreen from './components/WelcomeScreen';
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

export interface TripDates {
  startDate: string;
  endDate: string;
  specifyTimes: boolean;
  arrivalTime: string;
  leaveTime: string;
}

export interface WalkingPreferences {
  walkingTimeMinutes: number;
  walkingDistanceMiles: number;
}

function App() {

  const [tripDates, setTripDates] = useState<TripDates>({
    startDate: '',
    endDate: '',
    specifyTimes: false,
    arrivalTime: '00:00',
    leaveTime: '23:59',
  });

  const [walkingPreferences, setWalkingPreferences] = useState<WalkingPreferences>({
    walkingTimeMinutes: 10,
    walkingDistanceMiles: 0.5, // 10 min * 3 mph / 60 = 0.5 miles
  });

  // Dark mode state - controls theme across the entire app
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Apply dark mode class to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      setActiveSearchQuery(searchQuery);
      setIsSearching(true);
      // Reset searching state after a timeout to simulate loading "handoff"
      setTimeout(() => setIsSearching(false), 1000);
    }
  }, [searchQuery]);

  const handleDisplayStart = useCallback((mode: 'voice' | 'chat') => {
    setShowWelcome(false);
    // You could use the 'mode' here to trigger specific helper states if needed
    if (mode === 'voice') {
      // Trigger voice assistant logic later
    }
  }, []);

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

  if (showWelcome) {
    return <WelcomeScreen onStart={handleDisplayStart} />;
  }


  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Left Panel: Results + Itinerary Side by Side */}
      <div className="app-left-panel">
            <ItineraryPanel
              onLocationClick={handleLocationClick}
              customEvents={itineraryEvents}
              handleAddToItinerary={handleAddToItinerary}
              onRemoveEvent={handleRemoveFromItinerary}
              tripDates={tripDates}
              onTripDatesChange={setTripDates}
              walkingPreferences={walkingPreferences}
              onWalkingPreferencesChange={setWalkingPreferences}
            />
        </div>

      {/* Right Panel: 3D Map */}
      <div className="app-right-panel">
        <MapErrorBoundary>
          <Map3D
            settings={settings}
            selectedLocation={selectedLocation}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
          />
        </MapErrorBoundary>
      </div>
    </div>
  );
}

export default App;
