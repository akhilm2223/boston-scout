// MBTA V3 API Service - Full Integration
const MBTA_API_KEY = '46d30af6bff04b72ac8fcfaa9f644e35';
const MBTA_BASE_URL = 'https://api-v3.mbta.com';

export interface MBTAVehicle {
  id: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number | null;
  currentStatus: string;
  label: string;
  routeId: string;
  directionId: number;
  updatedAt: string;
  occupancyStatus: string | null;
  carriages: MBTACarriage[];
}

export interface MBTACarriage {
  label: string;
  occupancyStatus: string | null;
  occupancyPercentage: number | null;
}

export interface MBTARoute {
  id: string;
  color: string;
  textColor: string;
  longName: string;
  shortName: string;
  type: number;
}

export interface MBTAStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  wheelchairAccessible: boolean;
  locationType: number;
  platformCode: string | null;
}

export interface MBTAAlert {
  id: string;
  header: string;
  description: string;
  severity: number;
  lifecycle: string;
  effect: string;
  activePeriods: { start: string; end: string | null }[];
  routeIds: string[];
}

export interface MBTAPrediction {
  id: string;
  arrivalTime: string | null;
  departureTime: string | null;
  stopId: string;
  routeId: string;
  directionId: number;
  status: string | null;
}

export const ROUTE_TYPES = {
  LIGHT_RAIL: 0,
  HEAVY_RAIL: 1,
  COMMUTER_RAIL: 2,
  BUS: 3,
  FERRY: 4,
} as const;


// Fetch all vehicles (all types)
export async function fetchVehicles(routeTypes?: number[]): Promise<MBTAVehicle[]> {
  try {
    const params = new URLSearchParams({ 'api_key': MBTA_API_KEY });
    if (routeTypes && routeTypes.length > 0) {
      params.append('filter[route_type]', routeTypes.join(','));
    } else {
      // Default to strict filter: Light Rail, Heavy Rail, Commuter Rail only
      params.append('filter[route_type]', '0,1,2');
    }

    const response = await fetch(`${MBTA_BASE_URL}/vehicles?${params}`);
    if (!response.ok) throw new Error(`MBTA API error: ${response.status}`);

    const data = await response.json();
    return data.data.map((v: any) => ({
      id: v.id,
      latitude: v.attributes.latitude,
      longitude: v.attributes.longitude,
      bearing: v.attributes.bearing || 0,
      speed: v.attributes.speed,
      currentStatus: v.attributes.current_status,
      label: v.attributes.label,
      routeId: v.relationships?.route?.data?.id || 'unknown',
      directionId: v.attributes.direction_id,
      updatedAt: v.attributes.updated_at,
      occupancyStatus: v.attributes.occupancy_status,
      carriages: (v.attributes.carriages || []).map((c: any) => ({
        label: c.label,
        occupancyStatus: c.occupancy_status,
        occupancyPercentage: c.occupancy_percentage,
      })),
    }));
  } catch (error) {
    console.error('Failed to fetch MBTA vehicles:', error);
    return [];
  }
}

// Fetch routes
export async function fetchRoutes(): Promise<MBTARoute[]> {
  try {
    const response = await fetch(`${MBTA_BASE_URL}/routes?api_key=${MBTA_API_KEY}`);
    if (!response.ok) throw new Error(`MBTA API error: ${response.status}`);

    const data = await response.json();
    return data.data.map((r: any) => ({
      id: r.id,
      color: `#${r.attributes.color}`,
      textColor: `#${r.attributes.text_color}`,
      longName: r.attributes.long_name,
      shortName: r.attributes.short_name,
      type: r.attributes.type,
    }));
  } catch (error) {
    console.error('Failed to fetch MBTA routes:', error);
    return [];
  }
}

// Fetch stops
export async function fetchStops(routeTypes?: number[]): Promise<MBTAStop[]> {
  try {
    const params = new URLSearchParams({ 'api_key': MBTA_API_KEY });
    if (routeTypes && routeTypes.length > 0) {
      params.append('filter[route_type]', routeTypes.join(','));
    }

    const response = await fetch(`${MBTA_BASE_URL}/stops?${params}`);
    if (!response.ok) throw new Error(`MBTA API error: ${response.status}`);

    const data = await response.json();
    return data.data.map((s: any) => ({
      id: s.id,
      name: s.attributes.name,
      latitude: s.attributes.latitude,
      longitude: s.attributes.longitude,
      wheelchairAccessible: s.attributes.wheelchair_boarding === 1,
      locationType: s.attributes.location_type,
      platformCode: s.attributes.platform_code,
    }));
  } catch (error) {
    console.error('Failed to fetch MBTA stops:', error);
    return [];
  }
}


// Fetch active alerts
export async function fetchAlerts(): Promise<MBTAAlert[]> {
  try {
    const response = await fetch(`${MBTA_BASE_URL}/alerts?api_key=${MBTA_API_KEY}&filter[activity]=BOARD,EXIT,RIDE`);
    if (!response.ok) throw new Error(`MBTA API error: ${response.status}`);

    const data = await response.json();
    return data.data.map((a: any) => ({
      id: a.id,
      header: a.attributes.header,
      description: a.attributes.description,
      severity: a.attributes.severity,
      lifecycle: a.attributes.lifecycle,
      effect: a.attributes.effect,
      activePeriods: a.attributes.active_period || [],
      routeIds: a.relationships?.route?.data?.map((r: any) => r.id) || [],
    }));
  } catch (error) {
    console.error('Failed to fetch MBTA alerts:', error);
    return [];
  }
}

// Fetch predictions for a stop
export async function fetchPredictions(stopId: string): Promise<MBTAPrediction[]> {
  try {
    const params = new URLSearchParams({
      'api_key': MBTA_API_KEY,
      'filter[stop]': stopId,
      'sort': 'arrival_time',
    });

    const response = await fetch(`${MBTA_BASE_URL}/predictions?${params}`);
    if (!response.ok) throw new Error(`MBTA API error: ${response.status}`);

    const data = await response.json();
    return data.data.slice(0, 10).map((p: any) => ({
      id: p.id,
      arrivalTime: p.attributes.arrival_time,
      departureTime: p.attributes.departure_time,
      stopId: p.relationships?.stop?.data?.id,
      routeId: p.relationships?.route?.data?.id,
      directionId: p.attributes.direction_id,
      status: p.attributes.status,
    }));
  } catch (error) {
    console.error('Failed to fetch MBTA predictions:', error);
    return [];
  }
}

// Occupancy levels mapped to stress score (0-1)
const OCCUPANCY_STRESS: Record<string, number> = {
  'EMPTY': 0,
  'MANY_SEATS_AVAILABLE': 0.1,
  'FEW_SEATS_AVAILABLE': 0.3,
  'STANDING_ROOM_ONLY': 0.6,
  'CRUSHED_STANDING_ROOM_ONLY': 0.9,
  'FULL': 1.0,
  'NOT_ACCEPTING_PASSENGERS': 1.0,
  'NO_DATA_AVAILABLE': 0.2,
};

// Get stress color based on occupancy (green -> yellow -> red)
function getStressColor(stress: number): string {
  if (stress < 0.3) return '#4ade80'; // green - relaxed
  if (stress < 0.5) return '#facc15'; // yellow - moderate
  if (stress < 0.7) return '#fb923c'; // orange - busy
  return '#ef4444'; // red - stressed
}

// Convert vehicles to GeoJSON with occupancy stress
export function vehiclesToGeoJSON(
  vehicles: MBTAVehicle[],
  routes: Map<string, MBTARoute>,
  validRouteIds?: Set<string>
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = vehicles
    .filter(v => v.latitude && v.longitude)
    .map(vehicle => {
      const route = routes.get(vehicle.routeId);
      const routeColor = route?.color || '#888888';

      // Smart Opacity: Check if vehicle is on a known static track
      // User Request: "I want all trains subways" -> Disable ghost hiding. Show everything.
      const isValid = validRouteIds ? validRouteIds.has(vehicle.routeId) : true;
      const opacity = 1; // Always visible


      // Calculate stress from occupancy
      const stress = OCCUPANCY_STRESS[vehicle.occupancyStatus || 'NO_DATA_AVAILABLE'] || 0.2;
      const stressColor = getStressColor(stress);

      // Speed factor (0-1, where 1 is fast ~30mph)
      const speedFactor = vehicle.speed ? Math.min(vehicle.speed / 30, 1) : 0.5;

      // Carriage data for detailed view
      const carriageData = vehicle.carriages.map(c => ({
        label: c.label,
        stress: OCCUPANCY_STRESS[c.occupancyStatus || 'NO_DATA_AVAILABLE'] || 0.2,
      }));

      // Determine vehicle type
      let vehicleType = 'bus';
      if (route) {
        switch (route.type) {
          case ROUTE_TYPES.LIGHT_RAIL: vehicleType = 'lightrail'; break;
          case ROUTE_TYPES.HEAVY_RAIL: vehicleType = 'subway'; break;
          case ROUTE_TYPES.COMMUTER_RAIL: vehicleType = 'commuter'; break;
          case ROUTE_TYPES.FERRY: vehicleType = 'ferry'; break;
          default: vehicleType = 'bus';
        }
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [vehicle.longitude, vehicle.latitude]
        },
        properties: {
          id: vehicle.id,
          label: vehicle.label,
          routeId: vehicle.routeId,
          routeName: route?.longName || vehicle.routeId,
          routeColor,
          stressColor,
          stress,
          bearing: vehicle.bearing,
          status: vehicle.currentStatus,
          speed: vehicle.speed || 0,
          speedFactor,
          occupancy: vehicle.occupancyStatus || 'NO_DATA',
          carriageCount: vehicle.carriages.length,
          carriages: JSON.stringify(carriageData),
          isMoving: vehicle.currentStatus === 'IN_TRANSIT_TO',
          vehicleType,
          isBus: vehicleType === 'bus',
          isBus: vehicleType === 'bus',
          isRail: vehicleType !== 'bus' && vehicleType !== 'ferry',
          opacity,
        },
      };
    });

  return { type: 'FeatureCollection', features };
}

// Calculate route stress from vehicles on that route
export function calculateRouteStress(
  vehicles: MBTAVehicle[],
  routeId: string
): { stress: number; avgSpeed: number } {
  const routeVehicles = vehicles.filter(v => v.routeId === routeId);
  if (routeVehicles.length === 0) return { stress: 0.2, avgSpeed: 15 };

  const totalStress = routeVehicles.reduce((sum, v) => {
    return sum + (OCCUPANCY_STRESS[v.occupancyStatus || 'NO_DATA_AVAILABLE'] || 0.2);
  }, 0);

  const totalSpeed = routeVehicles.reduce((sum, v) => sum + (v.speed || 10), 0);

  return {
    stress: totalStress / routeVehicles.length,
    avgSpeed: totalSpeed / routeVehicles.length,
  };
}


// Convert stops to GeoJSON
export function stopsToGeoJSON(stops: MBTAStop[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = stops
    .filter(s => s.latitude && s.longitude && s.locationType === 1) // Only parent stations
    .map(stop => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [stop.longitude, stop.latitude] },
      properties: {
        id: stop.id,
        name: stop.name,
        wheelchair: stop.wheelchairAccessible,
        platformCode: stop.platformCode,
      },
    }));

  return { type: 'FeatureCollection', features };
}

// Get route type name
export function getRouteTypeName(type: number): string {
  switch (type) {
    case ROUTE_TYPES.LIGHT_RAIL: return 'Light Rail';
    case ROUTE_TYPES.HEAVY_RAIL: return 'Subway';
    case ROUTE_TYPES.COMMUTER_RAIL: return 'Commuter Rail';
    case ROUTE_TYPES.BUS: return 'Bus';
    case ROUTE_TYPES.FERRY: return 'Ferry';
    default: return 'Transit';
  }
}

// Fetch route shapes (actual track geometry)
export interface MBTAShape {
  id: string;
  routeId: string;
  polyline: [number, number][];
}

export async function fetchShapes(routeIds: string[]): Promise<MBTAShape[]> {
  try {
    const params = new URLSearchParams({
      'api_key': MBTA_API_KEY,
      'filter[route]': routeIds.join(','),
    });

    const response = await fetch(`${MBTA_BASE_URL}/shapes?${params}`);
    if (!response.ok) throw new Error(`MBTA API error: ${response.status}`);

    const data = await response.json();
    return data.data.map((s: any) => ({
      id: s.id,
      routeId: s.relationships?.route?.data?.id || '',
      polyline: decodePolyline(s.attributes.polyline),
    }));
  } catch (error) {
    console.error('Failed to fetch MBTA shapes:', error);
    return [];
  }
}

// Decode Google polyline format
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

// Convert shapes to GeoJSON with route stress from live vehicles
export function shapesToGeoJSON(
  shapes: MBTAShape[],
  routes: Map<string, MBTARoute>,
  alerts: MBTAAlert[],
  vehicles?: MBTAVehicle[]
): GeoJSON.FeatureCollection {
  // Group shapes by route and pick the longest one per route
  const routeShapes = new Map<string, MBTAShape>();
  shapes.forEach(shape => {
    const existing = routeShapes.get(shape.routeId);
    if (!existing || shape.polyline.length > existing.polyline.length) {
      routeShapes.set(shape.routeId, shape);
    }
  });

  const features: GeoJSON.Feature[] = [];

  routeShapes.forEach((shape, routeId) => {
    const route = routes.get(routeId);
    if (!route || shape.polyline.length < 2) return;

    // Check if route has alerts (delays)
    const hasAlert = alerts.some(a => a.routeIds.includes(routeId));

    // Calculate stress from live vehicles
    let stress = 0.2;
    let avgSpeed = 15;
    if (vehicles) {
      const routeStats = calculateRouteStress(vehicles, routeId);
      stress = routeStats.stress;
      avgSpeed = routeStats.avgSpeed;
    }

    // Stress color for the line
    const stressColor = stress < 0.3 ? '#4ade80' :
      stress < 0.5 ? '#facc15' :
        stress < 0.7 ? '#fb923c' : '#ef4444';

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: shape.polyline,
      },
      properties: {
        routeId,
        routeName: route.longName,
        color: route.color,
        stressColor,
        stress,
        avgSpeed,
        type: route.type,
        hasAlert,
        // Animation speed: faster trains = faster pulse
        pulseSpeed: Math.max(0.5, avgSpeed / 20),
      },
    });
  });

  return { type: 'FeatureCollection', features };
}
