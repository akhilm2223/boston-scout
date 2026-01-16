import { useState } from 'react';
import Map3D from './components/Map3D';
import ControlPanel from './components/ControlPanel';
import HUD from './components/HUD';
import WeatherOverlay from './components/WeatherOverlay';
import LocalWisdom from './components/LocalWisdom';
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
  const [settings, setSettings] = useState<CitySettings>({
    timeOfDay: 20, // Night for best effects
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

  const [stats, setStats] = useState({
    fps: 60,
    buildings: 0,
    lights: 0,
    vehicles: 0,
    mbtaVehicles: 0,
  });

  return (
    <div className="app">
      <Map3D settings={settings} onStatsUpdate={setStats} />
      <WeatherOverlay weather={settings.weather} />
      <HUD stats={stats} />
      <ControlPanel settings={settings} onSettingsChange={setSettings} />
      <LocalWisdom />
      {settings.glitchEffect && <div className="glitch-overlay" />}
    </div>
  );
}

export default App;
