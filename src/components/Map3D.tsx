import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CitySettings } from '../App';
import { 
  fetchVehicles, fetchRoutes, fetchStops, fetchAlerts, fetchShapes,
  vehiclesToGeoJSON, stopsToGeoJSON, shapesToGeoJSON,
  type MBTARoute, type MBTAVehicle, type MBTAAlert
} from '../services/mbtaApi';
import './Map3D.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiYW00MzY3IiwiYSI6ImNta2djd243azA0YnMzZG82MGgzczRyaWUifQ.BSxUeP5A3krtRHdzw2n3MA';

interface Map3DProps {
  settings: CitySettings;
  onStatsUpdate: (stats: { fps: number; buildings: number; lights: number; vehicles: number; mbtaVehicles: number }) => void;
}

const BOSTON_CENTER: [number, number] = [-71.4, 42.3]; // Between Boston and Worcester
const ALL_RAIL_ROUTES = [
  // Subway
  'Red', 'Orange', 'Blue', 'Green-B', 'Green-C', 'Green-D', 'Green-E', 'Mattapan',
  // Commuter Rail
  'CR-Worcester', 'CR-Framingham', 'CR-Needham', 'CR-Franklin', 'CR-Providence',
  'CR-Fairmount', 'CR-Middleborough', 'CR-Kingston', 'CR-Greenbush', 'CR-Newburyport',
  'CR-Haverhill', 'CR-Lowell', 'CR-Fitchburg',
];

export default function Map3D({ settings, onStatsUpdate }: Map3DProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  const mbtaIntervalRef = useRef<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mbtaRoutes, setMbtaRoutes] = useState<Map<string, MBTARoute>>(new Map());
  const [vehicles, setVehicles] = useState<MBTAVehicle[]>([]);
  const [alerts, setAlerts] = useState<MBTAAlert[]>([]);
  const [shapes, setShapes] = useState<any[]>([]);
  const [systemStress, setSystemStress] = useState(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: BOSTON_CENTER,
      zoom: 9, // Zoomed out to see Boston to Worcester
      pitch: 50,
      bearing: -17,
      antialias: true,
    });

    map.current = mapInstance;
    mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');

    mapInstance.on('load', async () => {
      // Terrain
      mapInstance.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

      // Sky
      mapInstance.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15,
        },
      });

      // 3D Buildings
      mapInstance.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'height'],
            0, '#1a1a2e',
            50, '#16213e',
            100, '#0f3460',
            200, '#533483',
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.9,
        },
      });

      // === TRANSIT LINES ===
      mapInstance.addSource('mbta-tracks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Track glow
      mapInstance.addLayer({
        id: 'tracks-glow',
        type: 'line',
        source: 'mbta-tracks',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 12,
          'line-blur': 6,
          'line-opacity': 0.4,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // Track core
      mapInstance.addLayer({
        id: 'tracks-core',
        type: 'line',
        source: 'mbta-tracks',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.9,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // === STOPS ===
      mapInstance.addSource('mbta-stops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      mapInstance.addLayer({
        id: 'stops',
        type: 'circle',
        source: 'mbta-stops',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 8],
          'circle-color': '#fff',
          'circle-stroke-color': '#00ffff',
          'circle-stroke-width': 2,
        },
        minzoom: 12,
      });

      // === VEHICLES ===
      mapInstance.addSource('mbta-vehicles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Vehicle glow
      mapInstance.addLayer({
        id: 'vehicles-glow',
        type: 'circle',
        source: 'mbta-vehicles',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 
            10, ['case', ['get', 'isBus'], 6, 12],
            16, ['case', ['get', 'isBus'], 10, 20]
          ],
          'circle-color': ['get', 'routeColor'],
          'circle-blur': 1,
          'circle-opacity': 0.6,
        },
      });

      // Vehicle dot
      mapInstance.addLayer({
        id: 'vehicles',
        type: 'circle',
        source: 'mbta-vehicles',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 
            10, ['case', ['get', 'isBus'], 3, 6],
            16, ['case', ['get', 'isBus'], 6, 12]
          ],
          'circle-color': ['get', 'routeColor'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });

      setIsLoaded(true);
      onStatsUpdate({ fps: 60, buildings: 1500, lights: 0, vehicles: 0, mbtaVehicles: 0 });
    });

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mbtaIntervalRef.current) clearInterval(mbtaIntervalRef.current);
      map.current?.remove();
    };
  }, []);

  // Load initial data
  useEffect(() => {
    if (!isLoaded) return;
    
    const loadData = async () => {
      const [routesData, alertsData, shapesData, stopsData] = await Promise.all([
        fetchRoutes(),
        fetchAlerts(),
        fetchShapes(ALL_RAIL_ROUTES),
        // All stops - subway, commuter rail, bus, ferry
        fetchStops(),
      ]);
      
      const routeMap = new Map(routesData.map(r => [r.id, r]));
      setMbtaRoutes(routeMap);
      setAlerts(alertsData);
      setShapes(shapesData);
      
      // Set stops
      if (map.current?.getSource('mbta-stops')) {
        (map.current.getSource('mbta-stops') as mapboxgl.GeoJSONSource).setData(stopsToGeoJSON(stopsData));
      }
    };
    
    loadData();
  }, [isLoaded]);

  // Update vehicles and track stress
  useEffect(() => {
    if (!map.current || !isLoaded || mbtaRoutes.size === 0 || shapes.length === 0) return;

    const updateData = async () => {
      // Fetch ALL vehicles - subway, commuter rail, buses, ferry, everything
      const vehiclesData = await fetchVehicles(); // No filter = all types
      setVehicles(vehiclesData);
      
      // Update vehicles layer
      const vehiclesGeoJson = vehiclesToGeoJSON(vehiclesData, mbtaRoutes);
      const vehicleSource = map.current?.getSource('mbta-vehicles') as mapboxgl.GeoJSONSource;
      if (vehicleSource) {
        vehicleSource.setData(vehiclesGeoJson);
      }
      
      // Update tracks with stress from vehicles
      const tracksGeoJson = shapesToGeoJSON(shapes, mbtaRoutes, alerts, vehiclesData);
      const tracksSource = map.current?.getSource('mbta-tracks') as mapboxgl.GeoJSONSource;
      if (tracksSource) {
        tracksSource.setData(tracksGeoJson);
      }
      
      // Calculate overall system stress
      const avgStress = vehiclesData.length > 0 
        ? vehiclesData.reduce((sum, v) => {
            const stressMap: Record<string, number> = {
              'EMPTY': 0, 'MANY_SEATS_AVAILABLE': 0.1, 'FEW_SEATS_AVAILABLE': 0.3,
              'STANDING_ROOM_ONLY': 0.6, 'CRUSHED_STANDING_ROOM_ONLY': 0.9, 'FULL': 1.0,
            };
            return sum + (stressMap[v.occupancyStatus || ''] || 0.2);
          }, 0) / vehiclesData.length
        : 0.2;
      setSystemStress(avgStress);
      
      // Count crowded trains
      const crowdedCount = vehiclesData.filter(v => 
        v.occupancyStatus === 'STANDING_ROOM_ONLY' || 
        v.occupancyStatus === 'CRUSHED_STANDING_ROOM_ONLY' ||
        v.occupancyStatus === 'FULL'
      ).length;
      
      onStatsUpdate({ 
        fps: 60, 
        buildings: 1500, 
        lights: vehiclesData.length,
        vehicles: crowdedCount,
        mbtaVehicles: vehiclesData.length 
      });
    };

    updateData();
    mbtaIntervalRef.current = window.setInterval(updateData, 8000);

    return () => {
      if (mbtaIntervalRef.current) clearInterval(mbtaIntervalRef.current);
    };
  }, [isLoaded, mbtaRoutes, shapes, alerts]);

  // Animate stress glow pulse - speed based on average vehicle speed
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    
    let phase = 0;
    const animate = () => {
      phase += 0.03;
      
      // Pulse intensity based on system stress
      const pulseIntensity = 0.4 + systemStress * 0.4;
      const glowOpacity = pulseIntensity + Math.sin(phase) * 0.2;
      
      if (map.current?.getLayer('tracks-stress-glow')) {
        map.current.setPaintProperty('tracks-stress-glow', 'line-opacity', glowOpacity);
      }
      
      // Pulse vehicle glow
      const vehicleGlow = 0.5 + Math.sin(phase * 1.5) * 0.2;
      if (map.current?.getLayer('vehicles-stress-glow')) {
        map.current.setPaintProperty('vehicles-stress-glow', 'circle-opacity', vehicleGlow);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isLoaded, systemStress]);

  // Time of day - realistic lighting
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const hour = settings.timeOfDay;
    const isNight = hour < 6 || hour >= 19;
    const isSunset = hour >= 17 && hour < 19;

    map.current.setFog({
      range: [1, 12 - settings.fogDensity * 6],
      color: isNight ? '#1a1a2e' : isSunset ? '#ffb366' : '#fff',
      'high-color': isNight ? '#000' : isSunset ? '#ff6b6b' : '#add8e6',
      'horizon-blend': 0.1,
      'space-color': isNight ? '#0a0a1a' : '#87ceeb',
      'star-intensity': isNight ? 0.3 : 0,
    });
  }, [settings.timeOfDay, settings.fogDensity, isLoaded]);

  // Toggle transit
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const vis = settings.showTransit ? 'visible' : 'none';
    ['tracks-glow', 'tracks-core'].forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.setLayoutProperty(layer, 'visibility', vis);
      }
    });
  }, [settings.showTransit, isLoaded]);

  const fitToNetwork = () => {
    // Fit to show Worcester to Boston
    map.current?.fitBounds([
      [-71.85, 42.2],  // Southwest - Worcester
      [-70.95, 42.5],  // Northeast - Boston
    ], {
      pitch: 50,
      bearing: 0,
      padding: 30,
    });
  };

  // Stress indicator color
  const stressLabel = systemStress < 0.3 ? 'Relaxed' : 
                      systemStress < 0.5 ? 'Normal' : 
                      systemStress < 0.7 ? 'Busy' : 'Stressed';
  const stressColorClass = systemStress < 0.3 ? 'green' : 
                           systemStress < 0.5 ? 'yellow' : 
                           systemStress < 0.7 ? 'orange' : 'red';

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container" />
      
      {/* System stress indicator */}
      <div className={`stress-indicator ${stressColorClass}`}>
        <div className="stress-bar" style={{ width: `${systemStress * 100}%` }} />
        <span className="stress-label">{stressLabel}</span>
        <span className="stress-count">{vehicles.length} vehicles</span>
      </div>

      <button className="network-btn" onClick={fitToNetwork}>
        View Network
      </button>
    </div>
  );
}
