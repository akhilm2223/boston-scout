import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CitySettings } from '../App';
import {
  fetchVehicles, fetchRoutes, fetchStops, fetchAlerts,
  vehiclesToGeoJSON, stopsToGeoJSON,
  type MBTARoute, type MBTAAlert
} from '../services/mbtaApi';
import { MBTA_STATIC_TRACKS } from '../data/mbtaStaticTracks';
import './Map3D.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiYW00MzY3IiwiYSI6ImNta2djd243azA0YnMzZG82MGgzczRyaWUifQ.BSxUeP5A3krtRHdzw2n3MA';

interface Map3DProps {
  settings: CitySettings;
  selectedLocation?: { location: [number, number]; name: string } | null;
}

// Boston downtown center
const BOSTON_CENTER: [number, number] = [-71.0589, 42.3601];


// Vascular Digital Twin color palette - MLK Weekend Edition
const VASCULAR_COLORS = {
  // Healthy flow - Electric Cyan
  healthyCyan: '#00f3ff',
  healthyCyanCore: '#ffffff',
  healthyCyanGlow: '#00b8cc',

  // Delayed/stressed flow - Deep Orange/Red
  delayCoral: '#ff3d00',
  delayCoralCore: '#fff4e6',
  delayCoralGlow: '#ff6b35',

  // Sentiment colors for building underglow
  positive: '#00f3ff',        // Cyan (parent-friendly, positive)
  negative: '#ffb347',        // Amber (crowded, tourist-heavy)
  neutral: '#4a6080',         // Cool gray

  // Dark atmosphere
  fogColor: '#0a0a0f',
  horizonColor: '#1a1a2e',
  spaceColor: '#000000',
};

// Interpolate color based on speed (fast = blue-white, slow = amber)
// Vascular flow colors based on speed and delay status
function getVascularColor(speed: number, hasDelay: boolean = false, maxSpeed: number = 60): { core: string; glow: string; trail: string } {
  // If route has delays, use coral/orange regardless of speed
  if (hasDelay) {
    return {
      core: VASCULAR_COLORS.delayCoralCore,
      glow: VASCULAR_COLORS.delayCoralGlow,
      trail: VASCULAR_COLORS.delayCoral,
    };
  }

  const t = Math.min(speed / maxSpeed, 1);

  if (t > 0.5) {
    // Fast: Electric Cyan (healthy flow)
    return {
      core: VASCULAR_COLORS.healthyCyanCore,
      glow: VASCULAR_COLORS.healthyCyanGlow,
      trail: VASCULAR_COLORS.healthyCyan,
    };
  } else if (t > 0.2) {
    // Medium: blend cyan to warm
    return {
      core: '#e0ffff',
      glow: '#00d4d4',
      trail: '#00e5e5',
    };
  } else {
    // Slow: warming towards delay colors
    return {
      core: VASCULAR_COLORS.delayCoralCore,
      glow: VASCULAR_COLORS.delayCoralGlow,
      trail: VASCULAR_COLORS.delayCoral,
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

  // LERP State: Stores current "flight" data for every vehicle
  // id -> { startLng, startLat, endLng, endLat, startBearing, endBearing, startTime, duration }
  const vehicleLerpRef = useRef<Map<string, any>>(new Map());


  const [isLoaded, setIsLoaded] = useState(false);
  const [mbtaRoutes, setMbtaRoutes] = useState<Map<string, MBTARoute>>(new Map());
  const [alerts, setAlerts] = useState<MBTAAlert[]>([]);

  const [systemStress, setSystemStress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate vascular light trail segments with speed-linked pulse
  const generateLightTrails = useCallback((
    coordinates: [number, number][],
    routeColor: string,
    phase: number,
    speed: number,
    hasDelay: boolean = false
  ): GeoJSON.Feature[] => {
    const features: GeoJSON.Feature[] = [];
    const totalPoints = coordinates.length;
    if (totalPoints < 2) return features;

    // Speed-linked pulse: Formula from spec
    // 60 MPH = 0.02, 10 MPH = 0.005
    // pulseSpeed = 0.005 + (avgSpeed / 60) * 0.015
    const flowSpeed = 0.005 + (speed / 60) * 0.015;
    const adjustedFlowSpeed = 0.2 + flowSpeed * 40; // Scale for visual effect
    const adjustedPhase = (phase * adjustedFlowSpeed) % 1;

    // Get vascular color based on speed and delay status
    const colors = getVascularColor(speed, hasDelay);

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
      // Reverting to Dark V11 for stability (Satellite might be failing)
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-71.0657, 42.3550], // Boston Common (Logic Lock)
      zoom: 13,
      pitch: 65, // Logic Lock Pitch
      bearing: -15, // Logic Lock Bearing
      maxBounds: [[-71.95, 42.15], [-70.85, 42.50]], // Worcester-to-Boston Corridor
      antialias: true,
      maxPitch: 85,
    });

    console.log('[Map3D] Container Dimensions:',
      mapContainer.current.clientWidth,
      mapContainer.current.clientHeight
    );

    map.current = mapInstance;

    mapInstance.on('style.load', () => {
      // Load the 3D Subway Model - Absolute path from public root
      mapInstance.addModel('subway-model', '/models/subway.glb');

      // Add standard lighting for 3D models (needed for simple GLB visibility)
      if (!mapInstance.getLayer('sky')) {
        mapInstance.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 0.0],
            'sky-atmosphere-sun-intensity': 15
          }
        });
      }

      // ===========================================
      // STYLES
      // ===========================================
    });

    mapInstance.on('style.load', () => {
      // Load the 3D Subway Model
      mapInstance.addModel('subway-model', './models/subway.glb');
    });

    mapInstance.on('load', async () => {

      // ===========================================
      // MBTA VASCULAR TRACKS ("River of Light")
      // ===========================================

      mapInstance.addSource('mbta-tracks', {
        type: 'geojson',
        data: MBTA_STATIC_TRACKS,
        lineMetrics: true,
      });

      console.log('[MBTA] Static tracks loaded:', MBTA_STATIC_TRACKS.features.length, 'routes');

      // GLOW ZONE - Underneath buildings
      // Style: "Sharp Vector" (Reference Image Match)
      mapInstance.addLayer({
        id: 'glow-zone',
        type: 'line',
        source: 'mbta-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          // Precise width: 2px -> 5px
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 16, 5],
          // Zero blur for sharp "vector" look
          'line-blur': 0,
          // Solid opacity
          'line-opacity': 1.0
        }
      });

      // ===========================================
      // BLACK BUILDINGS
      // ===========================================

      // Try to hide default 3D buildings
      const defaultBuildingLayers = [
        'building', 'building-extrusion', 'building-outline',
        '3d-buildings', 'building-models'
      ];
      defaultBuildingLayers.forEach(layerId => {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });

      // Add vector source for buildings
      if (!mapInstance.getSource('buildings-source')) {
        mapInstance.addSource('buildings-source', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-streets-v8'
        });
      }

      // Our custom pure black building layer
      mapInstance.addLayer({
        id: 'buildings-3d',
        source: 'buildings-source',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14, // CULLING: Hide when zoomed out
        paint: {
          'fill-extrusion-color': '#000000',
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 15],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-scale': 1.0,
          'fill-extrusion-ambient-occlusion-intensity': 0.3,
        },
      });

      mapInstance.addSource('mbta-trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
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
          'circle-color': VASCULAR_COLORS.positive,
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
          'circle-stroke-color': VASCULAR_COLORS.positive,
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

      // Vehicle glow halo (route color) - Restored as "Big Glow" backing for 3D model
      mapInstance.addLayer({
        id: 'vehicles-glow',
        type: 'circle',
        source: 'mbta-vehicles',
        // Show for all (Rail + Bus) to maintain consistency
        filter: ['!=', ['get', 'opacity'], 0],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            10, 15,  // Large glow at city scale
            14, 25,  // Big halo
            16, 45   // Massive street light effect
          ],
          'circle-color': ['get', 'routeColor'],
          'circle-blur': 1.0, // Max blur for "Glow" effect
          'circle-opacity': 0.6, // Visible but not overpowering the model
          'circle-translate': [0, 0],
        },
      });

      // ===========================================
      // 3D MODEL LAYER - High Fidelity Trains
      // ===========================================
      mapInstance.addLayer({
        id: 'mbta-subway-3d',
        type: 'model',
        source: 'mbta-vehicles',
        // Show all vehicles that have opacity > 0 (Rail AND Bus)
        filter: ['!=', ['get', 'opacity'], 0],
        layout: {
          'model-id': 'subway-model'
        },
        paint: {
          // DYNAMIC SCALING: "Little Big" Style
          'model-scale': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, ['literal', [80, 80, 80]], // Icon Mode (City View) - Boosted
            14, ['literal', [20, 20, 20]], // Mid-range
            16, ['literal', [9, 9, 9]],    // Approaching street
            18, [
              'case',
              ['==', ['get', 'vehicleType'], 'commuter'],
              ['literal', [3.3, 3.3, 3.3]], // Commuter Rail (+10%)
              ['==', ['get', 'vehicleType'], 'lightrail'],
              ['literal', [2.8, 2.8, 2.8]], // Green Line (+10%)
              ['==', ['get', 'vehicleType'], 'bus'],
              ['literal', [2.2, 2.2, 2.2]], // Bus (+10%)
              ['literal', [2.8, 2.8, 2.8]]  // Standard Subway (+10%)
            ]
          ],
          // REAL RUNNING: Rotate based on API bearing
          'model-rotation': [0, 0, ['get', 'bearing']],

          // REALISM RESTORED:
          // User wants "Real" train color (textures) + Glow.
          // Glow is handled by the 'vehicles-glow' halo layer behind this model.
          // We remove the artificial tint to let the GLB textures show.

          'model-emissive-strength': 1.0, // Ensure model is visible in dark mode
          'model-opacity': ['get', 'opacity']
        }
      });


      // ===== BUS MARKERS (Removed 2D circles, using 3D model now) =====
      /*
      mapInstance.addLayer({
        id: 'bus-body',
        type: 'circle',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'isBus'], true],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
          'circle-color': '#ffc72c', // MBTA Bus Yellow
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.8,
        },
      });
 
      // Bus route label
      mapInstance.addLayer({
        id: 'bus-label',
        type: 'symbol',
        source: 'mbta-vehicles',
        filter: ['==', ['get', 'isBus'], true],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 12],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
        minzoom: 14,
      });
      */

      // Bus direction arrow
      // Bus direction arrow removed (replaced by 3D model)

      // Train layers replaced by 3D model
      // Keeping direction arrow for debug/clarity if needed, but model has orientation


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
          // Reset to pure black and normal height
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-color', '#000000');
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-height', ['get', 'height']);
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-flood-light-intensity', 0.1);
        } else {
          selectedBuildingRef.current = buildingId;

          // X-RAY LIFT: Physically lift building 50 meters
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-height', [
            'case',
            ['==', ['id'], feature.id],
            ['+', ['coalesce', ['get', 'height'], 30], 50], // Lift 50m
            ['coalesce', ['get', 'height'], 30]
          ]);

          // Highlight selected building with vascular cyan
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-color', [
            'case',
            ['==', ['id'], feature.id],
            VASCULAR_COLORS.healthyCyan, // Electric Cyan highlight
            '#000000' // Pure black for others
          ]);

          // UNDER-GLOW: Apply flood light based on sentiment
          // For now, use cyan (positive) - can be linked to Reddit sentiment later
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-flood-light-color', VASCULAR_COLORS.positive);
          mapInstance.setPaintProperty('buildings-3d', 'fill-extrusion-flood-light-intensity', 0.6);
        }
      });

      // ===========================================
      // VEHICLE CLICK INTERACTION - Ghost Guard
      // ===========================================
      // Update to listen to 3D model layer
      mapInstance.on('click', 'mbta-subway-3d', (e) => {
        if (!e.features || e.features.length === 0) return;

        // Ghost Point Guard: Don't interact with invisible trains
        const properties = e.features[0].properties;
        if (properties?.opacity === 0) return;

        // Perform interaction (e.g. fly to, or show popup)
        const vehicleId = properties?.id;
        console.log('[MBTA] Clicked vehicle:', vehicleId, 'Route:', properties?.routeId);

        mapInstance.flyTo({
          center: (e.features[0].geometry as any).coordinates,
          zoom: 17,
          pitch: 60,
          essential: true
        });
      });

      // Cursor change on vehicle hover (respecting opacity)
      mapInstance.on('mouseenter', 'mbta-subway-3d', (e) => {
        if (e.features && e.features[0].properties?.opacity > 0) {
          mapInstance.getCanvas().style.cursor = 'pointer';
        }
      });

      mapInstance.on('mouseleave', 'mbta-subway-3d', () => {
        mapInstance.getCanvas().style.cursor = '';
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
      if (!map.current || !map.current.getStyle()) return; // Prevent access before style load

      console.log('[MBTA] Loading initial data...');
      // Tracks are now STATIC - only fetch routes, alerts, and stops
      const [routesData, alertsData, stopsData] = await Promise.all([
        fetchRoutes(),
        fetchAlerts(),
        fetchStops(),
      ]);

      console.log('[MBTA] Data loaded - routes:', routesData.length, 'stops:', stopsData.length, 'alerts:', alertsData.length);

      const routeMap = new Map(routesData.map(r => [r.id, r]));
      setMbtaRoutes(routeMap);
      setAlerts(alertsData);

      if (map.current?.getSource('mbta-stops')) {
        (map.current.getSource('mbta-stops') as mapboxgl.GeoJSONSource).setData(stopsToGeoJSON(stopsData));
      }

      // Static tracks are already loaded - just log confirmation
      console.log('[MBTA] Static tracks active:', MBTA_STATIC_TRACKS.features.length, 'routes');

      // Hide animated glow layers only - keep train layers visible
      const hiddenLayers = [
        'trails-glow', 'trails-core', 'trails-head',
        'stops-glow', 'stops-marker',
        'tracks-route-glow',
        // Hide buses only, keep trains
        'bus-body', 'bus-label', 'bus-direction',
        'ferry-body', 'ferry-label'
      ];
      hiddenLayers.forEach(layer => {
        if (map.current?.getLayer(layer)) {
          map.current.setLayoutProperty(layer, 'visibility', 'none');
        }
      });
    };

    loadData();
  }, [isLoaded]);

  // Real-time vehicle updates (tracks are STATIC, only vehicles are dynamic)
  useEffect(() => {
    if (!map.current || !isLoaded || mbtaRoutes.size === 0) return;

    const updateData = async () => {
      // RAIL ONLY: Filter to Light Rail (0), Heavy Rail (1), Commuter Rail (2)
      // Fetch ALL vehicle types (0-4) to ensure "all trains subways" + buses are seen
      const vehiclesData = await fetchVehicles([0, 1, 2, 3, 4]);

      // MOCK WORCESTER TRAIN (Ghost Injection for Demo)
      // If no CR-Worcester train exists, create one near WPI
      const hasWorcester = vehiclesData.some(v => v.routeId === 'CR-Worcester');
      if (!hasWorcester) {
        console.log('[MBTA] Injecting Mock Worcester Train');
        // Simulate a train moving from Worcester to Boston
        // Use a time-based position to simulate movement along the line
        const mockTime = Date.now() / 10000;
        const mockProgress = (mockTime % 100) / 100; // 0 to 1 loop

        // Approximate coordinates (Worcester -> Boston)
        // Start: -71.798547, 42.262046 (Union Station)
        // End: -71.055242, 42.366413 (South Station)
        const mockLat = 42.262046 + (42.366413 - 42.262046) * mockProgress;
        const mockLng = -71.798547 + (-71.055242 - -71.798547) * mockProgress;

        vehiclesData.push({
          id: 'mock-worcester-ghost',
          latitude: mockLat,
          longitude: mockLng,
          bearing: 80, // Roughly East
          speed: 45,
          currentStatus: 'IN_TRANSIT_TO',
          label: 'Ghost Train 404',
          routeId: 'CR-Worcester',
          directionId: 1,
          updatedAt: new Date().toISOString(),
          occupancyStatus: 'MANY_SEATS_AVAILABLE',
          carriages: []
        });
      }

      // Get valid route IDs from our static tracks
      const staticRouteIds = new Set(
        MBTA_STATIC_TRACKS.features.map(f => f.properties?.routeId)
      );

      // Valid routes from static tracks
      // Passed to vehiclesToGeoJSON for opacity handling (ghost points)

      console.log('[MBTA] Vehicles - total:', vehiclesData.length);
      // Create GeoJSON, but DON'T set it yet.
      // Update the LERP state instead.
      const now = performance.now();

      // Update LERP targets
      const currentLerpState = vehicleLerpRef.current;

      vehiclesData.forEach(v => {
        const id = v.id;
        const exists = currentLerpState.get(id);

        if (exists) {
          // Update existing: Old target becomes new start
          // We calculate where it *should* be right now to avoid jumps if we are mid-animation
          // actually, simplify: Start from current interpolated position? 
          // For robustness, start from "previous target" (which is where we arrived)
          // OR, if the API is slow, we might be sitting at "end" for a while.

          currentLerpState.set(id, {
            startLng: exists.endLng,
            startLat: exists.endLat,
            endLng: v.longitude,
            endLat: v.latitude,
            startBearing: exists.endBearing,
            endBearing: v.bearing,
            startTime: now,
            duration: 10000 // 10s smoothing
          });
        } else {
          // New vehicle: Start = End (no LERP for first frame)
          currentLerpState.set(id, {
            startLng: v.longitude,
            startLat: v.latitude,
            endLng: v.longitude,
            endLat: v.latitude,
            startBearing: v.bearing,
            endBearing: v.bearing,
            startTime: now,
            duration: 10000
          });
        }
      });

      // Prune old vehicles not in new data
      const newIds = new Set(vehiclesData.map(v => v.id));
      for (const [key] of currentLerpState) {
        if (!newIds.has(key)) {
          currentLerpState.delete(key);
        }
      }

      // Store the raw vehicles data (for properties like label, routeId etc)
      // We'll merge LERP'd coordinates with these properties in the animation loop
      // We can reuse the `vehiclesToGeoJSON` function but pass interpolated vehicles
      (window as any).rawVehicleData = vehiclesData; // Store globally or in ref? Ref is better.
      (window as any).mbtaRoutes = mbtaRoutes; // Need these for the loop
      (window as any).staticRouteIds = staticRouteIds;

      // Property Validation: Log warning for ghost vehicles (as requested for cleaning up route_ids)
      // We can check this on the raw data immediately
      const ghostCount = vehiclesData.filter(v => !staticRouteIds.has(v.routeId)).length;
      if (ghostCount > 0) {
        // Gather IDs
        const ghosts = vehiclesData.filter(v => !staticRouteIds.has(v.routeId));
        console.warn(`[MBTA] Found ${ghostCount} ghost vehicles. Routes:`,
          [...new Set(ghosts.map(v => v.routeId))].join(', ')
        );
      }


      // Note: Tracks are STATIC - no need to update them every poll

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


      // Populate route delays from alerts (for vascular coral coloring)


    };

    updateData();
    mbtaIntervalRef.current = window.setInterval(updateData, 8000);

    return () => {
      if (mbtaIntervalRef.current) clearInterval(mbtaIntervalRef.current);
    };
  }, [isLoaded, mbtaRoutes, alerts]);

  // ===========================================
  // MINIMAL ANIMATION - Building Breathing Only
  // ===========================================
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const animate = () => {
      pulsePhaseRef.current = (pulsePhaseRef.current + 0.005) % 1;
      const phase = pulsePhaseRef.current;

      // ===========================================
      // SUBTLE BUILDING BREATHING (1-2% oscillation)
      // ===========================================
      const breathingIntensity = 0.01 + systemStress * 0.01;
      const breathingScale = 1 + Math.sin(phase * Math.PI * 2) * breathingIntensity;

      if (map.current?.getStyle() && map.current.getLayer('buildings-3d')) {
        map.current.setPaintProperty('buildings-3d', 'fill-extrusion-vertical-scale', breathingScale);
      }

      // ===========================================
      // LERP ANIMATION LOOP
      // ===========================================
      // ===========================================
      // LERP ANIMATION LOOP
      // ===========================================
      // Safety Check: Ensure map and style are fully ready
      if (!map.current || !map.current.getStyle()) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      if ((window as any).rawVehicleData && map.current.getSource('mbta-vehicles')) {
        const now = performance.now();
        const rawVehicles = (window as any).rawVehicleData || [];
        const routes = (window as any).mbtaRoutes;
        const staticIds = (window as any).staticRouteIds;
        const lerpState = vehicleLerpRef.current;

        const interpolatedVehicles = rawVehicles.map((v: any) => {
          const state = lerpState.get(v.id);
          if (!state) return v;

          // Calculate progress (0 to 1)
          const t = Math.min((now - state.startTime) / state.duration, 1);

          // Interpolate Position
          // Simple Linear: P = A + (B - A) * t
          const lng = state.startLng + (state.endLng - state.startLng) * t;
          const lat = state.startLat + (state.endLat - state.startLat) * t;

          // Interpolate Bearing (Shortest path)
          let deltaBearing = state.endBearing - state.startBearing;
          if (deltaBearing > 180) deltaBearing -= 360;
          if (deltaBearing < -180) deltaBearing += 360;
          const bearing = state.startBearing + deltaBearing * t;

          return {
            ...v,
            longitude: lng,
            latitude: lat,
            bearing: bearing,
            // Keep speed same or interpolate? Keep same for now
          };
        });

        // Convert to GeoJSON
        // Note: calling vehiclesToGeoJSON every frame (60fps) is slightly expensive but for <100 vehicles it's negligible
        // Ideally we shouldn't recreate properties every frame, but the 3D model needs 'bearing' prop which changes.
        const geoJson = vehiclesToGeoJSON(interpolatedVehicles, routes, staticIds);

        const source = map.current.getSource('mbta-vehicles') as mapboxgl.GeoJSONSource;
        source.setData(geoJson);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isLoaded, systemStress]);

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
      'mbta-subway-3d', 'vehicles-glow', // New 3D layers
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

  // ===========================================
  // EXPAND MAP TOGGLE - Cinematic Fullscreen
  // ===========================================
  const handleExpandToggle = useCallback(() => {
    setIsExpanded(prev => {
      const newExpanded = !prev;

      if (map.current) {
        if (newExpanded) {
          // Worcester-Boston corridor view (45° pitch for better visibility)
          map.current.easeTo({
            center: [-71.35, 42.34], // Centered between Worcester and Boston
            pitch: 45,  // Reduced from 75° per architect feedback
            zoom: 10.5, // Wider to show corridor
            bearing: 70, // Align Worcester-Boston axis vertically
            duration: 1200,
          });
        } else {
          // Return to Boston downtown view
          map.current.easeTo({
            center: BOSTON_CENTER,
            pitch: 60,
            zoom: 14,
            bearing: -17,
            duration: 800,
          });
        }

        // Resize map after CSS transition
        setTimeout(() => {
          map.current?.resize();
        }, 550);
      }

      return newExpanded;
    });
  }, []);

  // Handler for "Back to WPI" - cinematic fly-to with 75° pitch
  const handleBackToWPI = useCallback(() => {
    if (map.current) {
      map.current.flyTo({
        center: [-71.798547, 42.262046], // Worcester Union Station
        pitch: 75, // Cinematic pitch for itinerary fly-to
        zoom: 14,
        bearing: 45,
        duration: 2500,
        essential: true,
      });
    }
  }, []);

  return (
    <div className={`map-wrapper ${isExpanded ? 'expanded' : ''}`}>
      <div ref={mapContainer} className="map-container" />

      {/* View Full Map Toggle Button */}
      <button
        className="expand-map-btn"
        onClick={handleExpandToggle}
        title={isExpanded ? 'Boston Downtown' : 'View Full Map'}
      >
        {isExpanded ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        )}
        <span className="btn-label">{isExpanded ? 'Downtown' : 'Full Map'}</span>
      </button>

      {/* Back to WPI Button - Always visible for parents/students */}
      <button
        className="back-to-wpi-btn"
        onClick={handleBackToWPI}
        title="Back to WPI / Worcester"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>Back to WPI</span>
      </button>
    </div>
  );
}
