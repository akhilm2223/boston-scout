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

  //Dark mode state - controls theme across the entire app
  const [isDarkMode, setIsDarkMode] = useState(false); // Default to light mode
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
  const [voiceOnboardingActive, setVoiceOnboardingActive] = useState(false);
  
  // Map control state for voice commands
  const [mapCommand, setMapCommand] = useState<{
    action: 'zoom_in' | 'zoom_out' | 'fly_to';
    location?: string;
    timestamp: number;
  } | null>(null);

  const handleDisplayStart = useCallback((mode: 'voice' | 'chat') => {
    setShowWelcome(false);

    // If voice mode, activate voice onboarding  
    if (mode === 'voice') {
      setVoiceOnboardingActive(true);
    }
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

  // Simple layer visibility setter for voice onboarding
  // For now, just log - Map3D manages its own layer state
  const handleSetLayerVisibility = useCallback((layer: 'places' | 'events' | 'landmarks', visible: boolean) => {
    console.log(`[App] Voice requested ${layer} layer:`, visible ? 'ON' : 'OFF');
    // TODO: Pass this to Map3D component to actually toggle layers
  }, []);

  // Map control handler for voice commands
  const handleMapControl = useCallback((action: 'zoom_in' | 'zoom_out' | 'fly_to', location?: string) => {
    console.log(`[App] Map control: ${action}`, location || '');
    setMapCommand({ action, location, timestamp: Date.now() });
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
          voiceOnboardingActive={voiceOnboardingActive}
          onVoiceOnboardingComplete={() => setVoiceOnboardingActive(false)}
          setLayerVisibility={handleSetLayerVisibility}
          onMapControl={handleMapControl}
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
            mapCommand={mapCommand}
          />
        </MapErrorBoundary>
      </div>
    </div>
  );
}

export default App;
