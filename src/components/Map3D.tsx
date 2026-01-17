import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CitySettings } from '../App';
import {
  fetchVehicles, fetchRoutes, fetchStops, fetchAlerts, fetchShapes,
  vehiclesToGeoJSON, stopsToGeoJSON, shapesToGeoJSON,
  type MBTARoute, type MBTAAlert, type MBTAShape
} from '../services/mbtaApi';
import './Map3D.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiYW00MzY3IiwiYSI6ImNta2djd243azA0YnMzZG82MGgzczRyaWUifQ.BSxUeP5A3krtRHdzw2n3MA';

interface Map3DProps {
  settings: CitySettings;
  selectedLocation?: { location: [number, number]; name: string } | null;
}

// Boston downtown center
const BOSTON_CENTER: [number, number] = [-71.0589, 42.3601];

// All tracked rail routes
const ALL_RAIL_ROUTES = [
  'Red', 'Orange', 'Blue', 'Green-B', 'Green-C', 'Green-D', 'Green-E', 'Mattapan',
  'CR-Worcester', 'CR-Framingham', 'CR-Needham', 'CR-Franklin', 'CR-Providence',
  'CR-Fairmount', 'CR-Middleborough', 'CR-Kingston', 'CR-Greenbush', 'CR-Newburyport',
  'CR-Haverhill', 'CR-Lowell', 'CR-Fitchburg',
];

// Photorealistic AR color palette
const AR_COLORS = {
  // Light trail colors (like long-exposure photography)
  fastFlow: '#e8f4ff',        // Bright white-blue (LED headlights)
  fastFlowCore: '#ffffff',    // Pure white core
  fastFlowGlow: '#4da6ff',    // Blue glow halo
  slowFlow: '#ffb347',        // Warm amber (caution)
  slowFlowCore: '#fff4e6',    // Warm white core
  slowFlowGlow: '#ff6b35',    // Orange-red glow (brake lights)

  // Sentiment colors (projected light aesthetic)
  positive: '#00d4aa',        // Teal/cyan (positive vibes)
  negative: '#ff8c42',        // Warm amber (caution/busy)
  neutral: '#a8c8e8',         // Soft blue-gray

  // Morning atmosphere
  hazeSky: '#b8d4e8',         // Pale morning blue
  hazeHorizon: '#ffd4a3',     // Soft orange horizon
  shadowTint: '#4a6080',      // Cool shadow color
};

// Interpolate color based on speed (fast = blue-white, slow = amber)
function getFlowColor(speed: number, maxSpeed: number = 60): { core: string; glow: string; trail: string } {
  const t = Math.min(speed / maxSpeed, 1);

  if (t > 0.5) {
    // Fast: white-blue
    return {
      core: AR_COLORS.fastFlowCore,
      glow: AR_COLORS.fastFlowGlow,
      trail: AR_COLORS.fastFlow,
    };
  } else if (t > 0.2) {
    // Medium: blend
    return {
      core: '#fff8f0',
      glow: '#ffa64d',
      trail: '#ffd699',
    };
  } else {
    // Slow: amber-red
    return {
      core: AR_COLORS.slowFlowCore,
      glow: AR_COLORS.slowFlowGlow,
      trail: AR_COLORS.slowFlow,
    };
  }
}

// Linear interpolation for colors
function lerpColor(c1: string, c2: string, t: number): string {
  const hex1 = parseInt(c1.slice(1), 16);
  const hex2 = parseInt(c2.slice(1), 16);
  const r = Math.round(((hex1 >> 16) & 0xff) + (((hex2 >> 16) & 0xff) - ((hex1 >> 16) & 0xff)) * t);
  const g = Math.round(((hex1 >> 8) & 0xff) + (((hex2 >> 8) & 0xff) - ((hex1 >> 8) & 0xff)) * t);
  const b = Math.round((hex1 & 0xff) + ((hex2 & 0xff) - (hex1 & 0xff)) * t);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function Map3D({ settings, selectedLocation }: Map3DProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  const mbtaIntervalRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef(0);
  const selectedBuildingRef = useRef<string | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [mbtaRoutes, setMbtaRoutes] = useState<Map<string, MBTARoute>>(new Map());
  const [alerts, setAlerts] = useState<MBTAAlert[]>([]);
  const [shapes, setShapes] = useState<MBTAShape[]>([]);
  const [systemStress, setSystemStress] = useState(0);
  const [routeSpeeds, setRouteSpeeds] = useState<Map<string, number>>(new Map());

  // Generate light trail segments with motion blur effect
  const generateLightTrails = useCallback((
    coordinates: [number, number][],
    routeColor: string,
    phase: number,
    speed: number
  ): GeoJSON.Feature[] => {
    const features: GeoJSON.Feature[] = [];
    const totalPoints = coordinates.length;
    if (totalPoints < 2) return features;

    // Speed affects how fast the light "moves" along the track
    const flowSpeed = 0.2 + (speed / 60) * 0.8;
    const adjustedPhase = (phase * flowSpeed) % 1;

    // Get color based on speed
    const colors = getFlowColor(speed);

    // Create multiple light pulses traveling along the track
    const numTrails = 3;
    const trailLength = 0.15; // 15% of track length for the trail

    for (let trail = 0; trail < numTrails; trail++) {
      const trailHead = (adjustedPhase + trail / numTrails) % 1;

      for (let i = 0; i < totalPoints - 1; i++) {
        const segmentStart = i / (totalPoints - 1);

        // Calculate how far this segment is from the trail head
        let distFromHead = segmentStart - trailHead;
        if (distFromHead < -0.5) distFromHead += 1;
        if (distFromHead > 0.5) distFromHead -= 1;

        // Only render segments within the trail length (behind the head)
        if (distFromHead >= -trailLength && distFromHead <= 0.02) {
          // Intensity falls off from head (brightest) to tail (fading)
          const trailPosition = 1 - Math.abs(distFromHead) / trailLength;
          const intensity = Math.pow(trailPosition, 1.5); // Exponential falloff for realistic motion blur

          // Head is white-hot, tail fades to route color
          const segmentColor = intensity > 0.8
            ? colors.core
            : intensity > 0.4
              ? lerpColor(colors.trail, colors.core, intensity)
              : lerpColor(routeColor, colors.trail, intensity * 2);

          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [coordinates[i], coordinates[i + 1]],
            },
            properties: {
              color: segmentColor,
              glowColor: colors.glow,
              intensity: 0.3 + intensity * 0.7,
              width: 2 + intensity * 6,
              blur: 1 + (1 - intensity) * 4,
              isHead: intensity > 0.9,
            },
          });
        }
      }
    }

    return features;
  }, []);

  // Initialize Mapbox with photorealistic satellite style
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      // Clean Standard style - best for 3D with custom buildings
      style: 'mapbox://styles/mapbox/standard',
      center: BOSTON_CENTER,
      zoom: 14,
      pitch: 60,
      bearing: -17,
      antialias: true,
      maxPitch: 85,
    });

    map.current = mapInstance;

    mapInstance.on('style.load', () => {
      // ===========================================
      // LIGHT PRESET - Clean daytime look
      // ===========================================

      // Use 'dusk' for a nice balance - not too bright, not too dark
      mapInstance.setConfigProperty('basemap', 'lightPreset', 'dusk');

      // Hide default 3D buildings from Standard style (we use our own)
      mapInstance.setConfigProperty('basemap', 'showPlaceLabels', true);
      mapInstance.setConfigProperty('basemap', 'showRoadLabels', true);
      mapInstance.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
      mapInstance.setConfigProperty('basemap', 'showTransitLabels', true);
    });

    mapInstance.on('load', async () => {
      // ===========================================
      // ATMOSPHERIC FOG - Subtle depth
      // ===========================================

      mapInstance.setFog({
        range: [1, 10],
        color: '#d8e4f0',              // Soft blue-gray
        'high-color': '#a8c0d8',       // Lighter blue at horizon
        'horizon-blend': 0.05,         // Subtle horizon
        'space-color': '#e0e8f0',      // Light sky
        'star-intensity': 0,
      });

      // ===========================================
      // BLACK BUILDINGS
      // ===========================================

      // Try to hide default 3D buildings from Standard style
      const defaultBuildingLayers = [
        'building', 'building-extrusion', 'building-outline',
        '3d-buildings', 'building-models'
      ];
      defaultBuildingLayers.forEach(layerId => {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });

      // Our custom pure black building layer
      mapInstance.addLayer({
        id: 'buildings-3d',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 12,
        paint: {
          // Pure black buildings
          'fill-extrusion-color': '#000000',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          // Solid black
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-scale': 1.0,
        },
      });

      // ===========================================
      // MBTA LIGHT TRAILS - BASE TRACKS
      // ===========================================

      mapInstance.addSource('mbta-tracks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      mapInstance.addSource('mbta-trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Subtle track bed (like painted road markings)
      mapInstance.addLayer({
        id: 'tracks-bed',
        type: 'line',
        source: 'mbta-tracks',
        paint: {
          'line-color': 'rgba(0, 0, 0, 0.3)',
          'line-width': 6,
          'line-opacity': 0.4,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // Track route color (subtle base glow)
      mapInstance.addLayer({
        id: 'tracks-route-glow',
        type: 'line',
        source: 'mbta-tracks',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 12,
          'line-blur': 8,
          'line-opacity': 0.2,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // Track core line
      mapInstance.addLayer({
        id: 'tracks-core',
        type: 'line',
        source: 'mbta-tracks',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.6,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ===========================================
      // ANIMATED LIGHT TRAILS LAYER
      // ===========================================

      // Trail glow (motion blur halo)
      mapInstance.addLayer({
        id: 'trails-glow',
        type: 'line',
        source: 'mbta-trails',
        paint: {
          'line-color': ['get', 'glowColor'],
          'line-width': ['*', ['get', 'width'], 3],
          'line-blur': ['get', 'blur'],
          'line-opacity': ['*', ['get', 'intensity'], 0.4],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // Trail core (bright leading edge)
      mapInstance.addLayer({
        id: 'trails-core',
        type: 'line',
        source: 'mbta-trails',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-blur': 0.5,
          'line-opacity': ['get', 'intensity'],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // Trail head highlight (brightest point)
      mapInstance.addLayer({
        id: 'trails-head',
        type: 'line',
        source: 'mbta-trails',
        filter: ['==', ['get', 'isHead'], true],
        paint: {
          'line-color': '#ffffff',
          'line-width': 4,
          'line-blur': 0,
          'line-opacity': 0.95,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ===========================================
      // STATION MARKERS (AR-style pins)
      // ===========================================

      mapInstance.addSource('mbta-stops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Station glow ring
      mapInstance.addLayer({
        id: 'stops-glow',
        type: 'circle',
        source: 'mbta-stops',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 20],
          'circle-color': AR_COLORS.positive,
          'circle-blur': 1,
          'circle-opacity': 0.3,
        },
        minzoom: 12,
      });

      // Station core marker
      mapInstance.addLayer({
        id: 'stops-marker',
        type: 'circle',
        source: 'mbta-stops',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
          'circle-color': '#ffffff',
          'circle-stroke-color': AR_COLORS.positive,
          'circle-stroke-width': 2,
        },
        minzoom: 12,
      });

      // ===========================================
      // REALISTIC VEHICLE MARKERS
      // ===========================================

      mapInstance.addSource('mbta-vehicles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Vehicle shadow (ground projection)
      mapInstance.addLayer({
        id: 'vehicles-shadow',
        type: 'circle',
        source: 'mbta-vehicles',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            12, ['case', ['get', 'isBus'], 5, 10],
            16, ['case', ['get', 'isBus'], 12, 22]
          ],
          'circle-color': '#000000',
          'circle-blur': 1.2,
          'circle-opacity': 0.2,
          'circle-translate': [2, 2],
        },
      });

      // Vehicle glow halo (route color) - creates glowing effect around vehicles
      mapInstance.addLayer({
        id: 'vehicles-glow',
        type: 'circle',
        source: 'mbta-vehicles',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            12, ['case', ['get', 'isBus'], 10, 18],
            16, ['case', ['get', 'isBus'], 22, 36]
          ],
          'circle-color': ['get', 'routeColor'],
          'circle-blur': 0.7,
          'circle-opacity': 0.5,
        },
      });

      // ===== BUS MARKERS (Solid colored with white outline) =====
      mapInstance.addLayer({
        id: 'bus-body',
        type: 'circle',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'isBus'], true],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 11],
          'circle-color': ['get', 'routeColor'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 3],
        },
      });

      // Bus route number label
      mapInstance.addLayer({
        id: 'bus-label',
        type: 'symbol',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'isBus'], true],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 12],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': ['get', 'routeColor'],
          'text-halo-width': 1,
        },
        minzoom: 14,
      });

      // Bus direction arrow
      mapInstance.addLayer({
        id: 'bus-direction',
        type: 'symbol',
        source: 'mbta-vehicles',
        filter: ['all', ['==', ['get', 'isBus'], true], ['==', ['get', 'isMoving'], true]],
        layout: {
          'icon-image': 'triangle-11',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 16, 1],
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-offset': [0, -12],
        },
        paint: {
          'icon-color': '#ffffff',
          'icon-opacity': 0.9,
        },
      });

      // ===== RAIL/TRAIN MARKERS (Larger, more prominent) =====
      // Train outer glow
      mapInstance.addLayer({
        id: 'train-outer-glow',
        type: 'circle',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'isRail'], true],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 12, 16, 28],
          'circle-color': ['get', 'routeColor'],
          'circle-blur': 0.5,
          'circle-opacity': 0.3,
        },
      });

      // Train body (main marker)
      mapInstance.addLayer({
        id: 'train-body',
        type: 'circle',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'isRail'], true],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 18],
          'circle-color': ['get', 'routeColor'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 4],
        },
      });

      // Train inner highlight (gives 3D effect)
      mapInstance.addLayer({
        id: 'train-highlight',
        type: 'circle',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'isRail'], true],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 10],
          'circle-color': '#ffffff',
          'circle-opacity': 0.3,
          'circle-translate': [-1, -1],
        },
      });

      // Train route label
      mapInstance.addLayer({
        id: 'train-label',
        type: 'symbol',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'isRail'], true],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 16, 14],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': ['get', 'routeColor'],
          'text-halo-width': 1.5,
        },
        minzoom: 13,
      });

      // Train direction arrow
      mapInstance.addLayer({
        id: 'train-direction',
        type: 'symbol',
        source: 'mbta-vehicles',
        filter: ['all', ['==', ['get', 'isRail'], true], ['==', ['get', 'isMoving'], true]],
        layout: {
          'icon-image': 'triangle-11',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 16, 1.4],
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-offset': [0, -18],
        },
        paint: {
          'icon-color': '#ffffff',
          'icon-opacity': 0.9,
        },
      });

      // ===== FERRY MARKERS =====
      mapInstance.addLayer({
        id: 'ferry-body',
        type: 'circle',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'vehicleType'], 'ferry'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 16],
          'circle-color': '#4a90d9',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });

      mapInstance.addLayer({
        id: 'ferry-label',
        type: 'symbol',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'vehicleType'], 'ferry'],
        layout: {
          'text-field': 'F',
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 14],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // ===========================================
      // BUILDING CLICK INTERACTION
      // ===========================================

      mapInstance.on('click', 'buildings-3d', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const buildingId = feature.id?.toString() || '';

        // Toggle selection
        if (selectedBuildingRef.current === buildingId) {
          selectedBuildingRef.current = null;
          // Reset to pure black
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-color', '#000000');
        } else {
          selectedBuildingRef.current = buildingId;
          // Highlight selected building with cyan color
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-color', [
            'case',
            ['==', ['id'], feature.id],
            '#00d4aa', // Cyan highlight
            '#000000' // Pure black for others
          ]);
        }
      });

      // Cursor change on building hover
      mapInstance.on('mouseenter', 'buildings-3d', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });

      mapInstance.on('mouseleave', 'buildings-3d', () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');

      setIsLoaded(true);
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
        fetchStops(),
      ]);

      const routeMap = new Map(routesData.map(r => [r.id, r]));
      setMbtaRoutes(routeMap);
      setAlerts(alertsData);
      setShapes(shapesData);

      if (map.current?.getSource('mbta-stops')) {
        (map.current.getSource('mbta-stops') as mapboxgl.GeoJSONSource).setData(stopsToGeoJSON(stopsData));
      }
    };

    loadData();
  }, [isLoaded]);

  // Real-time vehicle updates
  useEffect(() => {
    if (!map.current || !isLoaded || mbtaRoutes.size === 0 || shapes.length === 0) return;

    const updateData = async () => {
      const vehiclesData = await fetchVehicles();

      // Update vehicle positions
      const vehiclesGeoJson = vehiclesToGeoJSON(vehiclesData, mbtaRoutes);
      const vehicleSource = map.current?.getSource('mbta-vehicles') as mapboxgl.GeoJSONSource;
      if (vehicleSource) vehicleSource.setData(vehiclesGeoJson);

      // Update tracks
      const tracksGeoJson = shapesToGeoJSON(shapes, mbtaRoutes, alerts, vehiclesData);
      const tracksSource = map.current?.getSource('mbta-tracks') as mapboxgl.GeoJSONSource;
      if (tracksSource) tracksSource.setData(tracksGeoJson);

      // Calculate system stress and speed
      const stressMap: Record<string, number> = {
        'EMPTY': 0, 'MANY_SEATS_AVAILABLE': 0.1, 'FEW_SEATS_AVAILABLE': 0.3,
        'STANDING_ROOM_ONLY': 0.6, 'CRUSHED_STANDING_ROOM_ONLY': 0.9, 'FULL': 1.0,
      };

      let totalStress = 0, totalSpeed = 0, speedCount = 0;
      const routeSpeedMap = new Map<string, number>();

      vehiclesData.forEach(v => {
        totalStress += stressMap[v.occupancyStatus || ''] || 0.2;
        if (v.speed && v.speed > 0) {
          totalSpeed += v.speed;
          speedCount++;
          const current = routeSpeedMap.get(v.routeId) || 0;
          routeSpeedMap.set(v.routeId, Math.max(current, v.speed));
        }
      });

      setSystemStress(vehiclesData.length > 0 ? totalStress / vehiclesData.length : 0.2);
      setRouteSpeeds(routeSpeedMap);

    };

    updateData();
    mbtaIntervalRef.current = window.setInterval(updateData, 8000);

    return () => {
      if (mbtaIntervalRef.current) clearInterval(mbtaIntervalRef.current);
    };
  }, [isLoaded, mbtaRoutes, shapes, alerts]);

  // ===========================================
  // MAIN ANIMATION LOOP - Light Trails & Building Breathing
  // ===========================================
  useEffect(() => {
    if (!map.current || !isLoaded || shapes.length === 0) return;

    const animate = () => {
      // Slower, more elegant animation for photorealistic style
      const pulseSpeed = 0.003 + 0.008;
      pulsePhaseRef.current = (pulsePhaseRef.current + pulseSpeed) % 1;
      const phase = pulsePhaseRef.current;

      // ===========================================
      // GENERATE LIGHT TRAILS
      // ===========================================
      const trailFeatures: GeoJSON.Feature[] = [];

      const routeShapes = new Map<string, MBTAShape>();
      shapes.forEach(shape => {
        const existing = routeShapes.get(shape.routeId);
        if (!existing || shape.polyline.length > existing.polyline.length) {
          routeShapes.set(shape.routeId, shape);
        }
      });

      routeShapes.forEach((shape, routeId) => {
        const route = mbtaRoutes.get(routeId);
        if (!route || shape.polyline.length < 2) return;

        const routeSpeed = routeSpeeds.get(routeId) || 15;
        const trails = generateLightTrails(shape.polyline, route.color, phase, routeSpeed);
        trailFeatures.push(...trails);
      });

      const trailSource = map.current?.getSource('mbta-trails') as mapboxgl.GeoJSONSource;
      if (trailSource) {
        trailSource.setData({ type: 'FeatureCollection', features: trailFeatures });
      }

      // ===========================================
      // SUBTLE BUILDING BREATHING (1-2% oscillation)
      // ===========================================

      // Very subtle vertical scale based on system stress
      // More stress = slightly more "tension" in the buildings
      const breathingIntensity = 0.01 + systemStress * 0.01; // 1-2% max
      const breathingScale = 1 + Math.sin(phase * Math.PI * 2) * breathingIntensity;

      if (map.current?.getLayer('buildings-3d')) {
        map.current.setPaintProperty('buildings-3d', 'fill-extrusion-vertical-scale', breathingScale);

        // Adjust flood light based on system stress
        const floodColor = systemStress > 0.5
          ? lerpColor(AR_COLORS.neutral, AR_COLORS.negative, (systemStress - 0.5) * 2)
          : lerpColor(AR_COLORS.positive, AR_COLORS.neutral, systemStress * 2);

        const floodIntensity = 0.1 + systemStress * 0.15;

        map.current.setPaintProperty('buildings-3d', 'fill-extrusion-flood-light-color', floodColor);
        map.current.setPaintProperty('buildings-3d', 'fill-extrusion-flood-light-intensity', floodIntensity);
      }

      // ===========================================
      // SUBTLE TRACK GLOW ANIMATION
      // ===========================================
      const trackGlowOpacity = 0.15 + Math.sin(phase * Math.PI * 2) * 0.08;
      if (map.current?.getLayer('tracks-route-glow')) {
        map.current.setPaintProperty('tracks-route-glow', 'line-opacity', trackGlowOpacity);
      }

      // ===========================================
      // STATION MARKER PULSE
      // ===========================================
      const stationGlow = 0.25 + Math.sin(phase * Math.PI * 3) * 0.1;
      if (map.current?.getLayer('stops-glow')) {
        map.current.setPaintProperty('stops-glow', 'circle-opacity', stationGlow);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isLoaded, systemStress, shapes, mbtaRoutes, routeSpeeds, generateLightTrails]);

  // Transit visibility toggle
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const vis = settings.showTransit ? 'visible' : 'none';
    [
      'tracks-bed', 'tracks-route-glow', 'tracks-core',
      'trails-glow', 'trails-core', 'trails-head',
      'stops-glow', 'stops-marker',
      // Vehicle layers
      'vehicles-shadow', 'vehicles-glow',
      'bus-body', 'bus-label', 'bus-direction',
      'train-outer-glow', 'train-body', 'train-highlight', 'train-label', 'train-direction',
      'ferry-body', 'ferry-label'
    ].forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.setLayoutProperty(layer, 'visibility', vis);
      }
    });
  }, [settings.showTransit, isLoaded]);

  // Cinematic flyTo when location is selected from itinerary
  useEffect(() => {
    if (!map.current || !isLoaded || !selectedLocation) return;

    const { location } = selectedLocation;

    // Cinematic camera movement
    map.current.flyTo({
      center: location,
      zoom: 17,
      pitch: 70,
      bearing: 45,
      duration: 2500,
      essential: true,
      easing: (t) => t * (2 - t), // Ease out quad for smooth deceleration
    });

    // Building lift effect - highlight buildings near the selected location
    // Create a temporary pulse effect by adjusting building properties
    const pulseBuildings = () => {
      if (!map.current?.getLayer('buildings-3d')) return;

      // Temporarily increase vertical scale for dramatic effect
      map.current.setPaintProperty('buildings-3d', 'fill-extrusion-vertical-scale', 1.15);
      
      // Add cyan underglow to all buildings briefly
      map.current.setPaintProperty('buildings-3d', 'fill-extrusion-flood-light-color', '#00d4aa');
      map.current.setPaintProperty('buildings-3d', 'fill-extrusion-flood-light-intensity', 0.4);

      // Reset after animation
      setTimeout(() => {
        if (map.current?.getLayer('buildings-3d')) {
          map.current.setPaintProperty('buildings-3d', 'fill-extrusion-vertical-scale', 1.0);
          // Return to normal flood light (will be overridden by animation loop)
        }
      }, 1500);
    };

    // Trigger building lift after a short delay (when camera is moving)
    setTimeout(pulseBuildings, 500);

  }, [selectedLocation, isLoaded]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}
