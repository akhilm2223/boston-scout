import { useState, useCallback, useEffect } from 'react';
import Map3D from './components/Map3D';
import MapErrorBoundary from './components/MapErrorBoundary';
import ItineraryPanel from './components/ItineraryPanel';
import WelcomeScreen from './components/WelcomeScreen';
import { ItineraryEvent } from './types';
import './App.css';
import './styles/industrial.css';

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
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode for industrial theme
  const [isIndustrialTheme] = useState(true); // Enable industrial theme by default

  // Apply dark mode and industrial theme classes to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (isIndustrialTheme) {
      document.documentElement.classList.add('industrial');
    } else {
      document.documentElement.classList.remove('industrial');
    }
  }, [isDarkMode, isIndustrialTheme]);

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
  const [showWelcome, setShowWelcome] = useState(true);

  const handleDisplayStart = useCallback((_mode: 'voice' | 'chat') => {
    setShowWelcome(false);
  }, []);

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
      {/* App Header */}
      <div className="app-header">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'white',
          fontFamily: "'Inter', sans-serif"
        }}>
          {/* Logo Mark */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(0, 255, 255, 0.1)',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(0, 255, 255, 0.1)'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: '#00ffff',
              borderRadius: '50%',
              boxShadow: '0 0 8px #00ffff'
            }} />
          </div>

          {/* Brand Name */}
          <span style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            background: 'linear-gradient(90deg, #fff, #ccc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 15px rgba(255,255,255,0.2)'
          }}>
            Boston Visit
          </span>
        </div>
      </div>

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
