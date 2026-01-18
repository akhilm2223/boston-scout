import { useState, useEffect, useCallback, useRef } from 'react';
import type { HeroOption } from '../types/vector';

// MBTA API for real-time transit data
const MBTA_API_BASE = 'https://api-v3.mbta.com';

interface UseCityPulseOptions {
  updateIntervalMs?: number;
  mbtaApiKey?: string;
}

interface UseCityPulseReturn {
  transitSpeed: number; // 0-100 scale
  cityPulse: 'slow' | 'moderate' | 'active' | 'busy';
  activeAreas: string[];
  trending: string[];
  heroOptions: HeroOption[];
  isLoading: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Map transit speed to city pulse category
 */
function speedToPulse(speed: number): 'slow' | 'moderate' | 'active' | 'busy' {
  if (speed < 25) return 'slow';
  if (speed < 50) return 'moderate';
  if (speed < 75) return 'active';
  return 'busy';
}

/**
 * Generate hero options based on city pulse and time of day
 */
function generateHeroOptions(
  pulse: 'slow' | 'moderate' | 'active' | 'busy',
  hour: number
): HeroOption[] {
  const baseOptions: Record<string, HeroOption[]> = {
    morning: [
      { id: 'coffee', emoji: '☕', label: 'Coffee', query: 'coffee cafe morning breakfast' },
      { id: 'brunch', emoji: '🥞', label: 'Brunch', query: 'brunch breakfast eggs' },
      { id: 'bakery', emoji: '🥐', label: 'Bakery', query: 'bakery pastry fresh' },
      { id: 'parks', emoji: '🌳', label: 'Parks', query: 'park outdoor morning walk' }
    ],
    lunch: [
      { id: 'quick', emoji: '🥪', label: 'Quick Bite', query: 'lunch quick sandwich fast casual' },
      { id: 'healthy', emoji: '🥗', label: 'Healthy', query: 'salad healthy lunch light' },
      { id: 'asian', emoji: '🍜', label: 'Asian', query: 'asian noodles ramen pho' },
      { id: 'deli', emoji: '🥓', label: 'Deli', query: 'deli sandwich sub lunch' }
    ],
    afternoon: [
      { id: 'coffee', emoji: '☕', label: 'Coffee', query: 'coffee afternoon cafe' },
      { id: 'dessert', emoji: '🍰', label: 'Dessert', query: 'dessert sweet bakery ice cream' },
      { id: 'happy', emoji: '🍺', label: 'Happy Hour', query: 'bar happy hour drinks' },
      { id: 'museum', emoji: '🏛️', label: 'Museums', query: 'museum gallery art culture' }
    ],
    dinner: [
      { id: 'italian', emoji: '🍝', label: 'Italian', query: 'italian pasta dinner romantic' },
      { id: 'seafood', emoji: '🦞', label: 'Seafood', query: 'seafood lobster oyster boston' },
      { id: 'steakhouse', emoji: '🥩', label: 'Steakhouse', query: 'steak steakhouse dinner upscale' },
      { id: 'datenight', emoji: '🕯️', label: 'Date Night', query: 'romantic dinner date cozy' }
    ],
    night: [
      { id: 'bars', emoji: '🍸', label: 'Bars', query: 'bar cocktails nightlife drinks' },
      { id: 'live', emoji: '🎵', label: 'Live Music', query: 'live music concert jazz' },
      { id: 'club', emoji: '🪩', label: 'Clubs', query: 'club dance nightclub party' },
      { id: 'latenight', emoji: '🌙', label: 'Late Night', query: 'late night food open late' }
    ]
  };

  // Determine time of day
  let timeOfDay: keyof typeof baseOptions;
  if (hour >= 6 && hour < 11) timeOfDay = 'morning';
  else if (hour >= 11 && hour < 14) timeOfDay = 'lunch';
  else if (hour >= 14 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'dinner';
  else timeOfDay = 'night';

  const options = [...baseOptions[timeOfDay]];

  // Adjust based on city pulse
  if (pulse === 'busy') {
    // Add trending/popular options
    options[0] = { id: 'trending', emoji: '🔥', label: 'Trending', query: 'popular trending busy' };
  } else if (pulse === 'slow') {
    // Add relaxed/quiet options
    options[3] = { id: 'quiet', emoji: '🤫', label: 'Quiet Spots', query: 'quiet peaceful relaxed hidden' };
  }

  return options;
}

/**
 * Hook for real-time city pulse data
 * Integrates MBTA transit speed with dynamic hero options
 */
export function useCityPulse(options: UseCityPulseOptions = {}): UseCityPulseReturn {
  const { updateIntervalMs = 60000 } = options; // Default: update every minute

  const [transitSpeed, setTransitSpeed] = useState(50);
  const [activeAreas, setActiveAreas] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Fetch MBTA vehicle data and calculate transit "health"
   */
  const fetchTransitSpeed = useCallback(async (): Promise<number> => {
    try {
      // Fetch active vehicles
      const response = await fetch(
        `${MBTA_API_BASE}/vehicles?filter[route_type]=0,1&include=route`,
        {
          headers: {
            'Accept': 'application/vnd.api+json'
          }
        }
      );

      if (!response.ok) {
        console.warn('MBTA API error, using estimate');
        return estimateTransitSpeed();
      }

      const data = await response.json();
      const vehicles = data.data || [];

      // Calculate speed based on:
      // 1. Number of active vehicles (more = busier system)
      // 2. Current status (in_transit vs stopped)

      const activeCount = vehicles.length;
      const inTransitCount = vehicles.filter(
        (v: any) => v.attributes?.current_status === 'IN_TRANSIT_TO'
      ).length;

      // Normalize to 0-100 scale
      // Typical active vehicles: 50-150
      const activityScore = Math.min(100, (activeCount / 150) * 100);

      // In-transit ratio indicates flow health
      const flowRatio = activeCount > 0 ? inTransitCount / activeCount : 0.5;
      const flowScore = flowRatio * 100;

      // Combined score weighted towards activity
      const speed = Math.round(activityScore * 0.6 + flowScore * 0.4);

      return speed;

    } catch (err) {
      console.error('Transit speed fetch error:', err);
      return estimateTransitSpeed();
    }
  }, []);

  /**
   * Estimate transit speed based on time of day when API fails
   */
  function estimateTransitSpeed(): number {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Rush hour patterns
    if (!isWeekend) {
      if (hour >= 7 && hour <= 9) return 85; // Morning rush
      if (hour >= 16 && hour <= 18) return 90; // Evening rush
      if (hour >= 11 && hour <= 14) return 60; // Lunch
    } else {
      if (hour >= 11 && hour <= 15) return 55; // Weekend midday
      if (hour >= 19 && hour <= 22) return 65; // Weekend evening
    }

    // Off-peak
    if (hour >= 22 || hour <= 6) return 20; // Late night
    return 45; // Default moderate
  }

  /**
   * Determine active areas based on time and pulse
   */
  const getActiveAreas = useCallback((_pulse: 'slow' | 'moderate' | 'active' | 'busy'): string[] => {
    const hour = new Date().getHours();

    const areasByTime: Record<string, string[]> = {
      morning: ['Back Bay', 'Financial District', 'Cambridge'],
      lunch: ['Downtown', 'Seaport', 'Back Bay'],
      afternoon: ['Newbury Street', 'Harvard Square', 'North End'],
      dinner: ['North End', 'South End', 'Seaport'],
      night: ['Downtown', 'Fenway', 'Allston']
    };

    let timeKey: keyof typeof areasByTime;
    if (hour >= 6 && hour < 11) timeKey = 'morning';
    else if (hour >= 11 && hour < 14) timeKey = 'lunch';
    else if (hour >= 14 && hour < 17) timeKey = 'afternoon';
    else if (hour >= 17 && hour < 21) timeKey = 'dinner';
    else timeKey = 'night';

    return areasByTime[timeKey];
  }, []);

  /**
   * Refresh all city pulse data
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const speed = await fetchTransitSpeed();
      setTransitSpeed(speed);

      const pulse = speedToPulse(speed);
      setActiveAreas(getActiveAreas(pulse));

      // Could fetch trending from backend in future
      setTrending(['Seafood', 'Italian', 'Cocktails', 'Live Music']);

      setLastUpdate(new Date());
    } catch (err) {
      console.error('City pulse refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTransitSpeed, getActiveAreas]);

  // Initial fetch and interval setup
  useEffect(() => {
    refresh();

    intervalRef.current = setInterval(refresh, updateIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refresh, updateIntervalMs]);

  // Compute derived values
  const cityPulse = speedToPulse(transitSpeed);
  const heroOptions = generateHeroOptions(cityPulse, new Date().getHours());

  return {
    transitSpeed,
    cityPulse,
    activeAreas,
    trending,
    heroOptions,
    isLoading,
    lastUpdate,
    refresh
  };
}

export default useCityPulse;
