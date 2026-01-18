import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CitySettings } from '../App';
import {
  fetchVehicles, fetchRoutes, fetchStops, fetchAlerts,
  vehiclesToGeoJSON, stopsToGeoJSON,
  type MBTARoute, type MBTAAlert
} from '../services/mbtaApi';
import { fetchPlaces, placesToGeoJSON } from '../services/restaurantApi';
import { fetchEvents, eventsToGeoJSON, formatEventDate, formatEventTime } from '../services/eventsApi';
import { generatePlaceInsightHTML } from '../services/geminiApi';
import { MBTA_ARC_TRACKS } from '../data/mbtaArcTracks';
import { TRAINS_ARC_TRACKS } from '../data/trainsArcTracks';
import './Map3D.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

interface Map3DProps {
  settings: CitySettings;
  selectedLocation?: { location: [number, number]; name: string } | null;
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
}

// Boston downtown center
const BOSTON_CENTER: [number, number] = [-71.0589, 42.3601];


// Vascular Digital Twin color palette - MLK Weekend Edition
const VASCULAR_COLORS = {
	// Healthy flow - Electric Cyan
	healthyCyan: "#00f3ff",
	healthyCyanCore: "#ffffff",
	healthyCyanGlow: "#00b8cc",

	// Delayed/stressed flow - Deep Orange/Red
	delayCoral: "#ff3d00",
	delayCoralCore: "#fff4e6",
	delayCoralGlow: "#ff6b35",

	// Sentiment colors for building underglow
	positive: "#00f3ff", // Cyan (parent-friendly, positive)
	negative: "#ffb347", // Amber (crowded, tourist-heavy)
	neutral: "#4a6080", // Cool gray

	// Commuter rail colors
	commuterRailColor: "#56236E", // Brown/dark red for commuter rail
	commuterRailGlow: "#A0522D", // Sienna for glow

	// Amtrak colors
	amtrakColor: "#1e40af", // Deep blue for Amtrak

	// Dark atmosphere
	fogColor: "#0a0a0f",
	horizonColor: "#1a1a2e",
	spaceColor: "#000000",
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

export default function Map3D({ settings, selectedLocation, isDarkMode, setIsDarkMode }: Map3DProps) {
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
  const [showPlaces, setShowPlaces] = useState(false);
  const [showTransitLayers, setShowTransitLayers] = useState(true);
  const [showEvents, setShowEvents] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

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
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-71.0589, 42.3601], // Boston downtown
      zoom: 14, // Better zoom to see places/events (was 15)
      pitch: 60, // Reduced for better visibility (was 65)
      bearing: -15,
      maxBounds: [[-71.95, 42.15], [-70.85, 42.50]],
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
      // INITIAL VIEW - Disabled auto-tour for better UX
      // ===========================================

      // Set initial view to show downtown Boston with visible markers
      setTimeout(() => {
        mapInstance.easeTo({
          center: [-71.0589, 42.3601], // Boston downtown
          zoom: 14, // Good zoom to see places/events/transit
          pitch: 60,
          bearing: -15,
          duration: 1500
        });
        console.log('[Map] Initial view set - zoom in to see places and events');
      }, 500);

      // ===========================================
      // MBTA VASCULAR TRACKS ("River of Light")
      // ===========================================

      mapInstance.addSource('mbta-tracks', {
        type: 'geojson',
        data: MBTA_ARC_TRACKS,
        lineMetrics: true,
      });

      console.log('[MBTA] ARC tracks loaded:', MBTA_ARC_TRACKS.features.length, 'arcs');

      // GLOW ZONE - Underneath buildings
      // Style: "Sharp Vector" (Reference Image Match)
      // Map MBTA LINE values to official colors
      mapInstance.addLayer({
        id: 'glow-zone',
        type: 'line',
        source: 'mbta-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'LINE'],
            'RED', '#da291c',
            'BLUE', '#003da5',
            'ORANGE', '#ff7a00',
            'GREEN', '#00a651',
            'SILVER', '#7c8ca3',
            '#cccccc' // default gray
          ],
          // Precise width: 2px -> 5px
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 16, 5],
          // Zero blur for sharp "vector" look
          'line-blur': 0,
          // Solid opacity
          'line-opacity': 1.0
        }
      });

      // ===========================================
      // COMMUTER RAIL & AMTRAK TRACKS
      // ===========================================

      mapInstance.addSource('trains-tracks', {
        type: 'geojson',
        data: TRAINS_ARC_TRACKS,
        lineMetrics: true,
      });

      console.log('[Trains] ARC tracks loaded:', TRAINS_ARC_TRACKS.features.length, 'arcs');

      // Commuter rail main layer
      mapInstance.addLayer({
        id: 'trains-core',
        type: 'line',
        source: 'trains-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'OWNERSHIP'], 'AMTRAK'],
            VASCULAR_COLORS.amtrakColor,    // Blue for Amtrak
            VASCULAR_COLORS.commuterRailColor // Brown for commuter rail
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 1.5, 16, 2.5],
          'line-blur': 0.2,
          'line-opacity': 0.4
        }
      });

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

      // Our custom building layer - gray for light mode (default), black for dark mode
      mapInstance.addLayer({
        id: 'buildings-3d',
        source: 'buildings-source',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14, // CULLING: Hide when zoomed out
        paint: {
          'fill-extrusion-color': '#cccccc',
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 15],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.4,
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

      // Vehicle glow halo (route color)
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
        // // Only render 3D model for trains (not buses)
        // filter: ['all', ['!=', ['get', 'opacity'], 0], ['!=', ['get', 'vehicleType'], 'bus']],
        layout: {
          'model-id': 'subway-model'
        },
        paint: {
          // DYNAMIC SCALING: "Little Big" Style - ENLARGED
          'model-scale': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, ['literal', [160, 160, 160]], // Icon Mode (City View) - Boosted & Enlarged
            14, ['literal', [50, 50, 50]], // Mid-range - Enlarged
            16, ['literal', [20, 20, 20]],    // Approaching street - Enlarged
            18, [
              'case',
              ['==', ['get', 'vehicleType'], 'commuter'],
              ['literal', [7.0, 7.0, 7.0]], // Commuter Rail - Enlarged
              ['==', ['get', 'vehicleType'], 'lightrail'],
              ['literal', [10.0, 10.0, 10.0]], // Green Line - Enlarged
              ['==', ['get', 'vehicleType'], 'bus'],
              ['literal', [4.5, 4.5, 4.5]], // Bus - Enlarged
              ['literal', [10.0, 10.0, 10.0]]  // Standard Subway - Enlarged
            ]
          ],
          // REAL RUNNING: Rotate based on API bearing
          'model-rotation': [0, 0, ['get', 'bearing']],

          // ROUTE COLOR TINT: Apply line color to each subway model
          // Use routeColor directly - Mapbox should interpret hex colors
          'model-color': ['get', 'routeColor'],
          // Control the intensity of the color blend (0 = no tint, 1 = full color)
          'model-color-mix-intensity': 0.8,

          // REALISM RESTORED:
          // User wants "Real" train color (textures) + Glow.
          // Glow is handled by the 'vehicles-glow' halo layer behind this model.
          // Route color tint makes the model match the line color.

          'model-emissive-strength': 0.0, // No emissive glow - rely on halo layer for brightness
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
      // 3D HUMAN MODEL - Live Location Marker
      // ===========================================

      // Boston Common center coordinates (your live location)
      const humanLocation: [number, number] = [-71.0657, 42.3550];

      mapInstance.addSource('human-location', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: humanLocation
            },
            properties: {
              bearing: 0 // Can be updated for rotation
            }
          }]
        }
      });

      // 3D Human Model Layer
      mapInstance.addLayer({
        id: 'human-3d',
        type: 'model',
        source: 'human-location',
        layout: {
          'model-id': 'human-model'
        },
        paint: {
          // 10x larger scale - giant visible human
          'model-scale': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14, ['literal', [15, 15, 15]],   // 10x at city view
            16, ['literal', [30, 30, 30]],   // 10x at street view
            18, ['literal', [45, 45, 45]]    // 10x when zoomed in
          ],
          'model-rotation': [0, 0, ['get', 'bearing']],
          'model-emissive-strength': 1.2,
          'model-opacity': 1
        }
      });

      // Blue dot - current location marker (solid, prominent)
      mapInstance.addLayer({
        id: 'current-location-dot',
        type: 'circle',
        source: 'human-location',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 14, 8, 16, 12, 18, 16],
          'circle-color': '#0066ff', // Bright blue
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.9,
        },
        minzoom: 12,
      });

      // Pulsing halo around current location (live location indicator)
      mapInstance.addLayer({
        id: 'human-pulse',
        type: 'circle',
        source: 'human-location',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 8, 18, 20],
          'circle-color': '#0066ff', // Match the blue dot
          'circle-blur': 1,
          'circle-opacity': 0.3,
        },
        minzoom: 12,
      });

      // ===========================================
      // PLACE MARKERS
      // ===========================================

      mapInstance.addSource('places', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Place glow (rating-based color) - ENHANCED VISIBILITY
      mapInstance.addLayer({
        id: 'places-glow',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 14, 16, 20],
          'circle-color': ['get', 'markerColor'],
          'circle-blur': 0.8,
          'circle-opacity': 0.6,
        },
        minzoom: 10,
      });

      // Place marker - ENHANCED VISIBILITY
      mapInstance.addLayer({
        id: 'places-marker',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 6, 16, 10],
          'circle-color': ['get', 'markerColor'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
        minzoom: 10,
      });

      // Place labels (show at higher zoom)
      mapInstance.addLayer({
        id: 'places-label',
        type: 'symbol',
        source: 'places',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-max-width': 12,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
        minzoom: 15,
      });

      // ===========================================
      // EVENT MARKERS (3D "E" Text)
      // ===========================================

      mapInstance.addSource('events', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Event glow - ENHANCED VISIBILITY (bright purple/magenta)
      mapInstance.addLayer({
        id: 'events-glow',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 18, 16, 25],
          'circle-color': '#e879f9',
          'circle-blur': 0.8,
          'circle-opacity': 0.7,
        },
        minzoom: 10,
      });

      // Event "E" text marker - ENHANCED VISIBILITY
      mapInstance.addLayer({
        id: 'events-marker',
        type: 'symbol',
        source: 'events',
        layout: {
          'text-field': 'E',
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 16, 14, 24, 16, 32],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#a855f7',
          'text-halo-width': 3,
        },
        minzoom: 10,
      });

      // Event labels (show at higher zoom)
      mapInstance.addLayer({
        id: 'events-label',
        type: 'symbol',
        source: 'events',
        layout: {
          'text-field': ['get', 'title'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-max-width': 12,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
        minzoom: 14,
      });

      // Event click interaction
      mapInstance.on('click', 'events-marker', (e) => {
        if (!e.features || e.features.length === 0) return;

        const props = e.features[0].properties;
        if (!props) return;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();

        const startDate = formatEventDate(props.startTime);
        const startTime = formatEventTime(props.startTime);
        const endTime = formatEventTime(props.endTime);

        const photoUrl = props.photoName ?
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${props.photoName}&key=${GOOGLE_MAPS_API_KEY}` : '';

        const popupHTML = `
          <div class="event-popup" style="min-width: 280px; max-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
            
            ${photoUrl ? `<div class="popup-photo" style="width: 100%; height: 140px; background: linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%); border-radius: 8px 8px 0 0; margin: -5px -16px 12px -16px; position: relative; overflow: hidden;">
              <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" 
                onerror="this.parentElement.style.height='0'; this.parentElement.style.margin='0';" />
            </div>` : ''}

            <div style="padding: 4px 0;">
              <div style="display: inline-block; padding: 5px 12px; background: #000; color: #fff; border-radius: 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px;">
                Event
              </div>
              
              <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #000; line-height: 1.3; letter-spacing: -0.3px;">
                ${props.title}
              </h3>
              
              <div style="margin: 12px 0; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 15px;">📅</span>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-size: 14px; color: #000; font-weight: 700;">${startDate}</span>
                  <span style="font-size: 12px; color: #666; font-weight: 500;">${startTime} - ${endTime}</span>
                </div>
              </div>
              
              <div style="margin: 12px 0; display: flex; align-items: start; gap: 10px;">
                <span style="font-size: 15px; color: #000; margin-top: 2px;">📍</span>
                <span style="font-size: 13px; color: #000; font-weight: 600; line-height: 1.5;">${props.venueName}</span>
              </div>
              
              ${props.description ? `<div style="margin: 14px 0; padding: 12px; background: #fafafa; border-radius: 6px; border-left: 3px solid #000;">
                <div style="font-size: 13px; color: #1a1a1a; line-height: 1.6; font-weight: 500;">
                  ${props.description.substring(0, 150)}${props.description.length > 150 ? '...' : ''}
                </div>
              </div>` : ''}
              
              ${props.price && props.price !== 'Free' ? `<div style="margin: 12px 0; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Price:</span>
                <span style="font-size: 14px; color: #000; font-weight: 700;">${props.price}</span>
              </div>` : props.price === 'Free' ? `<div style="margin: 12px 0;">
                <span style="display: inline-block; padding: 4px 10px; background: #f0f0f0; color: #000; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;">FREE EVENT</span>
              </div>` : ''}
              
              ${props.sourceUrl ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #e5e7eb;">
                <a href="${props.sourceUrl}" target="_blank" style="display: block; text-align: center; padding: 11px 16px; background: #000; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 700; transition: all 0.2s; letter-spacing: 0.5px;">
                  View Details
                </a>
              </div>` : ''}
            </div>
          </div>
        `;

        new mapboxgl.Popup({ maxWidth: '340px', className: 'event-popup-container' })
          .setLngLat(coordinates)
          .setHTML(popupHTML)
          .addTo(mapInstance);
      });

      // Cursor change on event hover
      mapInstance.on('mouseenter', 'events-marker', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });

      mapInstance.on('mouseleave', 'events-marker', () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      // Place click interaction
      mapInstance.on('click', 'places-marker', async (e) => {
        if (!e.features || e.features.length === 0) return;

        const props = e.features[0].properties;
        if (!props) return;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();

        // Build rating stars (black and white)
        const rating = props.rating || 0;
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let starsHTML = '';
        for (let i = 0; i < 5; i++) {
          if (i < fullStars) {
            starsHTML += '<span style="color: #000;">★</span>';
          } else if (i === fullStars && hasHalfStar) {
            starsHTML += '<span style="color: #000;">⯨</span>';
          } else {
            starsHTML += '<span style="color: #d1d5db;">★</span>';
          }
        }

        // Price level (black)
        const priceLevel = props.priceLevel > 0 ? '<span style="color: #000; font-weight: 700; font-size: 14px;">' + '$'.repeat(props.priceLevel) + '</span>' : '';

        // Features badges (black and white)
        let badges = [];
        if (props.dineIn) badges.push('<span class="badge">Dine-in</span>');
        if (props.takeout) badges.push('<span class="badge">Takeout</span>');
        if (props.delivery) badges.push('<span class="badge">Delivery</span>');
        if (props.reservable) badges.push('<span class="badge">Reservations</span>');
        if (props.outdoor) badges.push('<span class="badge">Outdoor</span>');
        if (props.groups) badges.push('<span class="badge">Groups</span>');

        // Photo URL (black and white gradient fallback)
        const photoUrl = props.photoName ?
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${props.photoName}&key=${GOOGLE_MAPS_API_KEY}` : '';

        console.log('Generating Photo URL:', {
          name: props.name,
          photoName: props.photoName,
          hasKey: !!GOOGLE_MAPS_API_KEY,
          url: photoUrl
        });

        const photoHTML = props.photoName ?
          `<div class="popup-photo" style="width: 100%; height: 140px; background: linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%); border-radius: 8px 8px 0 0; margin: -12px -16px 12px -16px; position: relative; overflow: hidden;">
            <img src="${photoUrl}" 
                 style="width: 100%; height: 100%; object-fit: cover; filter: grayscale(100%);" 
                 onerror="this.parentElement.style.background='linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)'; this.style.display='none';" />
            <div style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); padding: 5px 10px; border-radius: 6px; font-size: 12px; color: #000; font-weight: 700; border: 1px solid #e5e7eb;">
              ${starsHTML} <span style="margin-left: 4px;">${rating.toFixed(1)}</span>
            </div>
          </div>`
          : '';

        // Generate Gemini insight
        const insightHTML = await generatePlaceInsightHTML(
          props.name,
          props.categories || '',
          rating,
          props.city
        );

        const popupHTML = `
          <div class="place-popup" style="min-width: 280px; max-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
            ${photoHTML}
            
            <div style="padding: ${photoHTML ? '0' : '4px 0'};">
              <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #000; line-height: 1.3; letter-spacing: -0.3px;">
                ${props.name}
              </h3>
              
              ${!photoHTML ? `<div style="margin: 10px 0; display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 15px; line-height: 1;">${starsHTML}</div>
                <span style="font-size: 15px; font-weight: 700; color: #000;">${rating > 0 ? rating.toFixed(1) : 'No rating'}</span>
                ${props.ratingCount > 0 ? `<span style="font-size: 13px; color: #666; font-weight: 500;">(${props.ratingCount})</span>` : ''}
                ${priceLevel ? `<span style="margin-left: auto;">${priceLevel}</span>` : ''}
              </div>` : ''}
              
              <div style="margin: 10px 0; display: flex; align-items: start; gap: 8px;">
                <span style="font-size: 14px; color: #000; margin-top: 1px;">📍</span>
                <span style="font-size: 13px; color: #000; font-weight: 500; line-height: 1.4;">${props.address}, ${props.city}</span>
              </div>
              
              ${props.categories ? `<div style="margin: 10px 0; font-size: 12px; color: #4a4a4a; line-height: 1.5; font-weight: 500;">
                ${props.categories.split(',').slice(0, 3).join(' • ')}
              </div>` : ''}
              
              ${insightHTML}
              
              ${badges.length > 0 ? `<div style="margin: 12px 0; display: flex; flex-wrap: wrap; gap: 6px;">
                ${badges.join('')}
              </div>` : ''}
              
              <div style="margin-top: 14px; padding-top: 14px; border-top: 2px solid #e5e7eb; display: flex; gap: 8px;">
                ${props.phone ? `<a href="tel:${props.phone}" style="flex: 1; text-align: center; padding: 10px 14px; background: #000; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 700; transition: all 0.2s; letter-spacing: 0.3px;">
                  Call
                </a>` : ''}
                ${props.googleMapsUrl ? `<a href="${props.googleMapsUrl}" target="_blank" style="flex: 1; text-align: center; padding: 10px 14px; background: #fff; color: #000; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 700; border: 2px solid #000; transition: all 0.2s; letter-spacing: 0.3px;">
                  Directions
                </a>` : ''}
              </div>
            </div>
          </div>
          
          <style>
            .badge {
              display: inline-block;
              padding: 5px 10px;
              background: #f5f5f5;
              color: #000;
              border-radius: 5px;
              font-size: 11px;
              font-weight: 600;
              border: 1.5px solid #d1d5db;
              letter-spacing: 0.2px;
            }
            .place-popup a:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .place-popup a:active {
              transform: translateY(0);
            }
          </style>
        `;

        new mapboxgl.Popup({ maxWidth: '340px', className: 'place-popup-container' })
          .setLngLat(coordinates)
          .setHTML(popupHTML)
          .addTo(mapInstance);
      });

      // Cursor change on place hover
      mapInstance.on('mouseenter', 'places-marker', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });

      mapInstance.on('mouseleave', 'places-marker', () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      // ===========================================
      // BUILDING CLICK INTERACTION - DISABLED
      // Building selection has been turned off
      /*
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
      */

      // ===========================================
      // VEHICLE CLICK INTERACTION - Detailed Info
      // ===========================================
      mapInstance.on('click', 'mbta-subway-3d', (e) => {
        if (!e.features || e.features.length === 0) return;

        // Ghost Point Guard: Don't interact with invisible trains
        const props = e.features[0].properties;
        if (!props) return;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();

        // Get vehicle type icon
        let vehicleIcon = '🚇';
        let vehicleTypeName = 'Subway';
        if (props.vehicleType === 'lightrail') {
          vehicleIcon = '🚊';
          vehicleTypeName = 'Light Rail';
        } else if (props.vehicleType === 'commuter') {
          vehicleIcon = '🚆';
          vehicleTypeName = 'Commuter Rail';
        } else if (props.vehicleType === 'bus') {
          vehicleIcon = '🚌';
          vehicleTypeName = 'Bus';
        } else if (props.vehicleType === 'ferry') {
          vehicleIcon = '⛴️';
          vehicleTypeName = 'Ferry';
        }

        // Status text
        let statusText = 'In Transit';
        if (props.status === 'STOPPED_AT') statusText = 'Stopped at Station';
        else if (props.status === 'INCOMING_AT') statusText = 'Arriving Soon';

        // Occupancy/crowding
        let crowdingText = 'Unknown';
        let crowdingColor = '#666';
        if (props.occupancy === 'MANY_SEATS_AVAILABLE') {
          crowdingText = 'Plenty of Seats';
          crowdingColor = '#10b981';
        } else if (props.occupancy === 'FEW_SEATS_AVAILABLE') {
          crowdingText = 'Few Seats';
          crowdingColor = '#f59e0b';
        } else if (props.occupancy === 'STANDING_ROOM_ONLY') {
          crowdingText = 'Standing Room';
          crowdingColor = '#ef4444';
        } else if (props.occupancy === 'FULL') {
          crowdingText = 'Full';
          crowdingColor = '#dc2626';
        }

        const popupHTML = `
          <div class="transit-popup" style="min-width: 260px; max-width: 300px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
            <div style="padding: 4px 0;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                <span style="font-size: 32px;">${vehicleIcon}</span>
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${vehicleTypeName}
                  </div>
                  <h3 style="margin: 2px 0 0 0; font-size: 18px; font-weight: 700; color: #000; line-height: 1.2;">
                    ${props.label || 'Vehicle ' + props.id.substring(0, 8)}
                  </h3>
                </div>
              </div>
              
              <div style="margin: 12px 0; padding: 10px; background: #fafafa; border-radius: 6px; border-left: 3px solid ${props.routeColor || '#000'};">
                <div style="font-size: 12px; font-weight: 700; color: #000; margin-bottom: 4px;">
                  ${props.routeName || props.routeId}
                </div>
                <div style="font-size: 11px; color: #666; font-weight: 500;">
                  ${statusText}
                </div>
              </div>
              
              ${props.speed > 0 ? `<div style="margin: 10px 0; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">⚡</span>
                <span style="font-size: 13px; color: #000; font-weight: 600;">${Math.round(props.speed)} mph</span>
              </div>` : ''}
              
              <div style="margin: 10px 0; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">👥</span>
                <span style="font-size: 13px; color: ${crowdingColor}; font-weight: 600;">${crowdingText}</span>
              </div>
              
              ${props.carriageCount > 0 ? `<div style="margin: 10px 0; font-size: 12px; color: #666;">
                ${props.carriageCount} car${props.carriageCount > 1 ? 's' : ''}
              </div>` : ''}
            </div>
          </div>
        `;

        new mapboxgl.Popup({ maxWidth: '320px', className: 'transit-popup-container' })
          .setLngLat(coordinates)
          .setHTML(popupHTML)
          .addTo(mapInstance);

        // Also fly to the vehicle
        mapInstance.flyTo({
          center: coordinates,
          zoom: 17,
          pitch: 60,
          duration: 1500,
          essential: true
        });
      });

      // ===========================================
      // STATION/STOP CLICK INTERACTION
      // ===========================================
      mapInstance.on('click', 'stops-marker', (e) => {
        if (!e.features || e.features.length === 0) return;

        const props = e.features[0].properties;
        if (!props) return;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();

        const popupHTML = `
          <div class="station-popup" style="min-width: 240px; max-width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
            <div style="padding: 4px 0;">
              <div style="display: inline-block; padding: 4px 10px; background: #000; color: #fff; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                Station
              </div>
              
              <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #000; line-height: 1.3;">
                ${props.name}
              </h3>
              
              ${props.wheelchair ? `<div style="margin: 10px 0; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">♿</span>
                <span style="font-size: 12px; color: #10b981; font-weight: 600;">Wheelchair Accessible</span>
              </div>` : ''}
              
              ${props.platformCode ? `<div style="margin: 10px 0; font-size: 12px; color: #666;">
                Platform: <span style="font-weight: 600; color: #000;">${props.platformCode}</span>
              </div>` : ''}
              
              <div style="margin-top: 12px; padding-top: 12px; border-top: 2px solid #e5e7eb; font-size: 11px; color: #666;">
                Click for live arrivals
              </div>
            </div>
          </div>
        `;

        new mapboxgl.Popup({ maxWidth: '300px', className: 'station-popup-container' })
          .setLngLat(coordinates)
          .setHTML(popupHTML)
          .addTo(mapInstance);
      });

      // Cursor change on stop hover
      mapInstance.on('mouseenter', 'stops-marker', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });

      mapInstance.on('mouseleave', 'stops-marker', () => {
        mapInstance.getCanvas().style.cursor = '';
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

      // Add Geolocation Control - asks browser for user's location
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true,
      });
      mapInstance.addControl(geolocate, 'top-right');

      // Listen for geolocation results
      geolocate.on('geolocate', (e: any) => {
        const coords: [number, number] = [e.coords.longitude, e.coords.latitude];
        setUserLocation(coords);
        console.log('[Geolocation] User location:', coords);
      });

      // ===========================================
      // LOAD INITIAL DATA DIRECTLY (Right after sources are created)
      // ===========================================
      console.log('[Map] Loading initial data inside on(load)...');

      try {
        const [routesData, alertsData, stopsData, placesData, eventsData] = await Promise.all([
          fetchRoutes(),
          fetchAlerts(),
          fetchStops(),
          fetchPlaces(),
          fetchEvents(),
        ]);

        console.log('[MBTA] Data loaded - routes:', routesData.length, 'stops:', stopsData.length, 'alerts:', alertsData.length);
        console.log('[Places] Loaded:', placesData.length, 'places');
        console.log('[Events] Loaded:', eventsData.length, 'events');

        // Set stops data
        if (mapInstance.getSource('mbta-stops')) {
          (mapInstance.getSource('mbta-stops') as mapboxgl.GeoJSONSource).setData(stopsToGeoJSON(stopsData));
          console.log('[MBTA] Stops set on map');
        } else {
          console.warn('[MBTA] Stops source not found!');
        }

        // Set places data
        if (mapInstance.getSource('places')) {
          const placeGeoJSON = placesToGeoJSON(placesData);
          console.log('[Places] Setting GeoJSON with', placeGeoJSON.features.length, 'features');
          (mapInstance.getSource('places') as mapboxgl.GeoJSONSource).setData(placeGeoJSON);
          console.log('[Places] ✓ Data set on map!');
        } else {
          console.warn('[Places] Source not found!');
        }

        // Set events data
        if (mapInstance.getSource('events')) {
          const eventsGeoJSON = eventsToGeoJSON(eventsData);
          console.log('[Events] Setting GeoJSON with', eventsGeoJSON.features.length, 'features');
          (mapInstance.getSource('events') as mapboxgl.GeoJSONSource).setData(eventsGeoJSON);
          console.log('[Events] ✓ Data set on map!');
        } else {
          console.warn('[Events] Source not found!');
        }

        // Store route data for vehicle updates
        const routeMap = new Map(routesData.map(r => [r.id, r]));
        setMbtaRoutes(routeMap);
        setAlerts(alertsData);

        console.log('[Map] ✓ All initial data loaded successfully!');
      } catch (error) {
        console.error('[Map] Error loading initial data:', error);
      }

      setIsLoaded(true);
    });

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mbtaIntervalRef.current) clearInterval(mbtaIntervalRef.current);
      map.current?.remove();
    };
  }, []);

  // Real-time vehicle updates (tracks are STATIC, only vehicles are dynamic)
  useEffect(() => {
    if (!map.current || !isLoaded || mbtaRoutes.size === 0) return;

    const updateData = async () => {
      // Fetch ALL vehicle types (0-4) to show complete transit picture
      // 0=Light Rail, 1=Heavy Rail, 2=Commuter Rail, 3=Bus, 4=Ferry
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

      // Get valid arc IDs from our MBTA arc tracks
      const staticRouteIds = new Set(
        MBTA_ARC_TRACKS.features.map(f => f.properties?.ROUTEID || f.properties?.routeId)
      );

      // Valid routes from ARC tracks (shapefile data)
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
        // Convert to GeoJSON - show ALL vehicles (no ghost filtering)
        const geoJson = vehiclesToGeoJSON(interpolatedVehicles, routes, undefined);

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
    const vis = settings.showTransit && showTransitLayers ? 'visible' : 'none';
    const layers = [
      'tracks-bed', 'tracks-route-glow', 'tracks-core',
      'trails-glow', 'trails-core', 'trails-head',
      'stops-glow', 'stops-marker',
      'glow-zone',
      // Commuter rail and Amtrak layers
      'trains-core',
      // Vehicle layers
      'vehicles-shadow', 'vehicles-glow',
      'bus-body', 'bus-label', 'bus-direction',
      'mbta-subway-3d', 'vehicles-glow', // New 3D layers
      'ferry-body', 'ferry-label'
    ];
    
    layers.forEach(layer => {
      try {
        if (map.current?.getLayer(layer)) {
          map.current.setLayoutProperty(layer, 'visibility', vis);
          console.log(`[Transit] ${layer} visibility set to ${vis}`);
        }
      } catch (error) {
        // Silently skip layers that don't exist (some may be optional)
      }
    });
  }, [settings.showTransit, showTransitLayers, isLoaded]);

  // Update user location marker when location changes
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    
    const source = map.current.getSource('human-location') as mapboxgl.GeoJSONSource;
    if (!source) return;

    const location = userLocation || [-71.0657, 42.3550]; // Default to Boston Common if no location
    
    source.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: location
        },
        properties: {
          bearing: 0
        }
      }]
    });

    if (userLocation) {
      console.log('[Map] User location marker updated:', userLocation);
    }
  }, [userLocation, isLoaded]);

  // Place visibility toggle
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const vis = showPlaces ? 'visible' : 'none';
    const layers = [
      'places-glow',
      'places-marker',
      'places-label'
    ];
    
    layers.forEach(layer => {
      try {
        if (map.current?.getLayer(layer)) {
          map.current.setLayoutProperty(layer, 'visibility', vis);
          console.log(`[Places] ${layer} visibility set to ${vis}`);
        } else {
          console.warn(`[Places] Layer "${layer}" not found on map`);
        }
      } catch (error) {
        console.error(`[Places] Error setting visibility for ${layer}:`, error);
      }
    });
  }, [showPlaces, isLoaded]);

  // Events visibility toggle
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const vis = showEvents ? 'visible' : 'none';
    const layers = [
      'events-glow',
      'events-marker',
      'events-label'
    ];
    
    layers.forEach(layer => {
      try {
        if (map.current?.getLayer(layer)) {
          map.current.setLayoutProperty(layer, 'visibility', vis);
          console.log(`[Events] ${layer} visibility set to ${vis}`);
        } else {
          console.warn(`[Events] Layer "${layer}" not found on map`);
        }
      } catch (error) {
        console.error(`[Events] Error setting visibility for ${layer}:`, error);
      }
    });
  }, [showEvents, isLoaded]);

  // 2D/3D mode toggle
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    map.current.easeTo({
      pitch: is3DMode ? 65 : 0,
      duration: 800
    });
  }, [is3DMode, isLoaded]);

  // Dark/Light mode toggle - Track if this is first run
  const darkModeInitializedRef = useRef(false);

  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // Skip the first run after isLoaded becomes true - we're already on light mode
    if (!darkModeInitializedRef.current) {
      darkModeInitializedRef.current = true;
      console.log('[Map] Dark/Light mode toggle initialized (skipping first run)');
      return;
    }

    const style = isDarkMode
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11';

    console.log('[Map] Changing style to:', isDarkMode ? 'light' : 'dark');
    // Store current camera position
    const currentCenter = map.current.getCenter();
    const currentZoom = map.current.getZoom();
    const currentPitch = map.current.getPitch();
    const currentBearing = map.current.getBearing();

    map.current.setStyle(style);

    // Re-add all layers after style loads
    map.current.once('style.load', () => {
      if (!map.current) return;

      // Restore camera position
      map.current.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        pitch: currentPitch,
        bearing: currentBearing
      });

      // Re-add 3D buildings layer
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
      )?.id;

      // Add vector source for buildings if not exists
      if (!map.current.getSource('buildings-source')) {
        map.current.addSource('buildings-source', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-streets-v8'
        });
      }

      // Add 3D buildings layer
      if (!map.current.getLayer('buildings-3d')) {
        map.current.addLayer({
          id: 'buildings-3d',
          source: 'buildings-source',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': isDarkMode ? '#000000' : '#cccccc',
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 15],
            'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
            'fill-extrusion-opacity': isDarkMode ? 0.92 : 0.7,
            'fill-extrusion-vertical-scale': 1.0,
            'fill-extrusion-ambient-occlusion-intensity': 0.3,
          },
        }, labelLayerId);
      }

      console.log('[Map] Style changed, 3D buildings re-added');

      // Re-add transit and events sources and layers after style change
      const redrawTransitAndEvents = async () => {
        if (!map.current) return;

        try {
          // Fetch current data
          const [stopsData, placesData, eventsData] = await Promise.all([
            fetchStops(),
            fetchPlaces(),
            fetchEvents(),
          ]);

          // Re-add MBTA tracks source and glow-zone layer
          if (!map.current.getSource('mbta-tracks')) {
            map.current.addSource('mbta-tracks', {
              type: 'geojson',
              data: MBTA_ARC_TRACKS,
              lineMetrics: true,
            });
          }

          // Re-add glow-zone layer if it doesn't exist
          if (!map.current.getLayer('glow-zone')) {
            map.current.addLayer({
              id: 'glow-zone',
              type: 'line',
              source: 'mbta-tracks',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': [
                  'match',
                  ['get', 'LINE'],
                  'RED', '#da291c',
                  'BLUE', '#003da5',
                  'ORANGE', '#ff7a00',
                  'GREEN', '#00a651',
                  'SILVER', '#7c8ca3',
                  '#cccccc'
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 16, 5],
                'line-blur': 0,
                'line-opacity': 1.0
              }
            });
          }

          // Re-add mbta-trails source if needed
          if (!map.current.getSource('mbta-trails')) {
            map.current.addSource('mbta-trails', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            });
          }

          // Re-add trail layers if they don't exist
          if (!map.current.getLayer('trails-glow')) {
            map.current.addLayer({
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
          }

          if (!map.current.getLayer('trails-core')) {
            map.current.addLayer({
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
          }

          if (!map.current.getLayer('trails-head')) {
            map.current.addLayer({
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
          }

          // Re-add stops source and layers
          if (!map.current.getSource('mbta-stops')) {
            map.current.addSource('mbta-stops', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            });
          }

          if (map.current.getSource('mbta-stops')) {
            (map.current.getSource('mbta-stops') as mapboxgl.GeoJSONSource).setData(stopsToGeoJSON(stopsData));
          }

          // Re-add stop layers if they don't exist
          if (!map.current.getLayer('stops-glow')) {
            map.current.addLayer({
              id: 'stops-glow',
              type: 'circle',
              source: 'mbta-stops',
              paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 20],
                'circle-color': VASCULAR_COLORS.negative,
                'circle-blur': 1,
                'circle-opacity': 0.3,
              },
              minzoom: 12,
            });
          }

          if (!map.current.getLayer('stops-marker')) {
            map.current.addLayer({
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
          }

          // Re-add trains tracks source and layers
          if (!map.current.getSource('trains-tracks')) {
            map.current.addSource('trains-tracks', {
              type: 'geojson',
              data: TRAINS_ARC_TRACKS,
              lineMetrics: true,
            });
          }

          // Re-add trains core layer
          if (!map.current.getLayer('trains-core')) {
            map.current.addLayer({
              id: 'trains-core',
              type: 'line',
              source: 'trains-tracks',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': [
                  'case',
                  ['==', ['get', 'OWNERSHIP'], 'AMTRAK'],
                  VASCULAR_COLORS.amtrakColor,
                  VASCULAR_COLORS.commuterRailColor
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 1.5, 16, 2.5],
                'line-blur': 0.2,
                'line-opacity': 0.4
              }
            });
          }

          // Re-add places source and layers - ONLY if places are toggled on
          if (showPlaces) {
            if (!map.current.getSource('places')) {
              map.current.addSource('places', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
              });
            }

            if (map.current.getSource('places')) {
              (map.current.getSource('places') as mapboxgl.GeoJSONSource).setData(placesToGeoJSON(placesData));
            }

            // Re-add place layers if they don't exist
            if (!map.current.getLayer('places-glow')) {
              map.current.addLayer({
                id: 'places-glow',
                type: 'circle',
                source: 'places',
                paint: {
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 14, 16, 20],
                  'circle-color': ['get', 'markerColor'],
                  'circle-blur': 0.8,
                  'circle-opacity': 0.6,
                },
                minzoom: 10,
              });
            }

            if (!map.current.getLayer('places-marker')) {
              map.current.addLayer({
                id: 'places-marker',
                type: 'circle',
                source: 'places',
                paint: {
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 6, 16, 10],
                  'circle-color': ['get', 'markerColor'],
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 2,
                },
                minzoom: 10,
              });
            }

            if (!map.current.getLayer('places-label')) {
              map.current.addLayer({
                id: 'places-label',
                type: 'symbol',
                source: 'places',
                layout: {
                  'text-field': ['get', 'name'],
                  'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                  'text-size': 11,
                  'text-offset': [0, 1.2],
                  'text-anchor': 'top',
                  'text-max-width': 12,
                },
                paint: {
                  'text-color': '#ffffff',
                  'text-halo-color': '#000000',
                  'text-halo-width': 1.5,
                },
                minzoom: 15,
              });
            }
          }

          // Re-add events source and layers - ONLY if events are toggled on
          if (showEvents) {
            if (!map.current.getSource('events')) {
              map.current.addSource('events', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
              });
            }

            if (map.current.getSource('events')) {
              (map.current.getSource('events') as mapboxgl.GeoJSONSource).setData(eventsToGeoJSON(eventsData));
            }

            // Re-add event layers if they don't exist
            if (!map.current.getLayer('events-glow')) {
              map.current.addLayer({
                id: 'events-glow',
                type: 'circle',
                source: 'events',
                paint: {
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 18, 16, 25],
                  'circle-color': '#e879f9',
                  'circle-blur': 0.8,
                  'circle-opacity': 0.7,
                },
                minzoom: 10,
              });
            }

            if (!map.current.getLayer('events-marker')) {
              map.current.addLayer({
                id: 'events-marker',
                type: 'symbol',
                source: 'events',
                layout: {
                  'text-field': 'E',
                  'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                  'text-size': ['interpolate', ['linear'], ['zoom'], 10, 16, 14, 24, 16, 32],
                  'text-allow-overlap': true,
                },
                paint: {
                  'text-color': '#ffffff',
                  'text-halo-color': '#a855f7',
                  'text-halo-width': 3,
                },
                minzoom: 10,
              });
            }

            if (!map.current.getLayer('events-label')) {
              map.current.addLayer({
                id: 'events-label',
                type: 'symbol',
                source: 'events',
                layout: {
                  'text-field': ['get', 'title'],
                  'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                  'text-size': 11,
                  'text-offset': [0, 1.8],
                  'text-anchor': 'top',
                  'text-max-width': 12,
                },
                paint: {
                  'text-color': '#ffffff',
                  'text-halo-color': '#000000',
                  'text-halo-width': 1.5,
                },
                minzoom: 14,
              });
            }
          }

          console.log('[Map] Transit and events redrawn after style change');
        } catch (error) {
          console.error('[Map] Error redrawing transit and events:', error);
        }
      };

      redrawTransitAndEvents();
    });
  }, [isDarkMode, isLoaded]);

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

  return (
    <div className={`map-wrapper ${isExpanded ? 'expanded' : ''}`}>
      <div ref={mapContainer} className="map-container" />

      {/* Layer Toggle Controls */}
      <div className="layer-toggle-controls">
        <button
          className={`layer-toggle-btn ${showTransitLayers ? 'active' : ''}`}
          onClick={() => setShowTransitLayers(!showTransitLayers)}
          title="Toggle Transit"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M3 10h18M7 14h.01M17 14h.01M7 18h10" />
          </svg>
          <span>Transit</span>
        </button>

        <button
          className={`layer-toggle-btn ${showPlaces ? 'active' : ''}`}
          onClick={() => setShowPlaces(!showPlaces)}
          title="Toggle Places"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
            </svg>
          <span>Places</span>
        </button>

        <button
          className={`layer-toggle-btn ${showEvents ? 'active' : ''}`}
          onClick={() => setShowEvents(!showEvents)}
          title="Toggle Events"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Events</span>
        </button>
      </div>

      {/* View Mode Controls - Under Zoom */}
      <div className="view-mode-controls">
        <button
          className={`view-mode-btn ${is3DMode ? 'active' : ''}`}
          onClick={() => setIs3DMode(!is3DMode)}
          title={is3DMode ? 'Switch to 2D' : 'Switch to 3D'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {is3DMode ? (
              <>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </>
            ) : (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </>
            )}
          </svg>
          <span>{is3DMode ? '3D' : '2D'}</span>
        </button>

        <button
          className={`view-mode-btn ${isDarkMode ? 'active' : ''}`}
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isDarkMode ? (
              <>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </>
            )}
          </svg>
          <span>{isDarkMode ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* View Full Map Toggle Button */}
      {/* <button
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
      </button> */}
    </div>
  );
}
