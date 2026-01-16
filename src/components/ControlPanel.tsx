import { useState } from 'react';
import type { CitySettings } from '../App';
import './ControlPanel.css';

interface ControlPanelProps {
  settings: CitySettings;
  onSettingsChange: (settings: CitySettings) => void;
}

export default function ControlPanel({ settings, onSettingsChange }: ControlPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  
  const update = <K extends keyof CitySettings>(key: K, value: CitySettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const formatTime = (hour: number) => {
    const h = Math.floor(hour) % 12 || 12;
    const ampm = hour >= 12 && hour < 24 ? 'PM' : 'AM';
    return `${h} ${ampm}`;
  };

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h2>BOSTON TRANSIT</h2>
        <button 
          className={`settings-toggle ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙
        </button>
      </div>

      {/* Time slider - always visible */}
      <div className="control-section">
        <div className="time-display">
          <span className="time-value">{formatTime(settings.timeOfDay)}</span>
        </div>
        <input
          type="range"
          className="slider"
          min="0"
          max="24"
          step="0.5"
          value={settings.timeOfDay}
          onChange={(e) => update('timeOfDay', parseFloat(e.target.value))}
        />
      </div>

      {/* Collapsible settings */}
      {showSettings && (
        <div className="settings-panel">
          <div className="control-section">
            <label className="section-label">Fog</label>
            <input
              type="range"
              className="slider"
              min="0"
              max="1"
              step="0.1"
              value={settings.fogDensity}
              onChange={(e) => update('fogDensity', parseFloat(e.target.value))}
            />
          </div>

          <div className="toggle-list">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={settings.showTransit}
                onChange={(e) => update('showTransit', e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span>Transit Lines</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
