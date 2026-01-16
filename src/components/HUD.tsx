import './HUD.css';

interface HUDProps {
  stats: {
    fps: number;
    buildings: number;
    lights: number;
    vehicles: number;
    mbtaVehicles: number;
  };
}

export default function HUD({ stats }: HUDProps) {
  return (
    <div className="hud">
      {/* Minimal top-right info */}
      <div className="hud-info">
        <span className="info-label">MBTA Live</span>
        <span className="info-value">{stats.mbtaVehicles}</span>
      </div>
    </div>
  );
}
