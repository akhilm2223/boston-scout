import { useState, useCallback, useRef, useEffect } from 'react';
import type { VectorSearchResult, VibeSearchResponse, InfiniteScrollResponse } from '../types/vector';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface UseVectorSearchOptions {
  debounceMs?: number;
  initialLimit?: number;
}

interface UseVectorSearchReturn {
  // Search state
  query: string;
  setQuery: (query: string) => void;
  results: VectorSearchResult[];
  isLoading: boolean;
  error: string | null;

  // Pagination
  hasMore: boolean;
  loadMore: () => Promise<void>;
  cursor: string | null;
  total: number;

  // Actions
  search: (query: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for vector-based semantic search with debouncing and pagination
 */
export function useVectorSearch(options: UseVectorSearchOptions = {}): UseVectorSearchReturn {
  const { debounceMs = 300, initialLimit = 10 } = options;

  // State
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<VectorSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Refs for debouncing and caching
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Perform vector search
   */
  const search = useCallback(async (searchQuery: string) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!searchQuery.trim()) {
      setResults([]);
      setHasMore(false);
      setCursor(null);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/api/places/vibe-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          limit: initialLimit
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: VibeSearchResponse = await response.json();

      setResults(data.results);
      setTotal(data.count);
      setHasMore(data.results.length >= initialLimit);
      setCursor(data.results.length > 0 ? data.results[data.results.length - 1]._id : null);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      console.error('Vector search error:', err);
      setError('Failed to search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [initialLimit]);

  /**
   * Load more results (pagination)
   */
  const loadMore = useCallback(async () => {
    if (!cursor || isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        cursor,
        limit: initialLimit.toString(),
        query
      });

      const infiniteResponse = await fetch(
        `${API_BASE_URL}/api/places/infinite?${params}`
      );

      if (!infiniteResponse.ok) {
        throw new Error('Failed to load more results');
      }

      const data: InfiniteScrollResponse = await infiniteResponse.json();

      setResults(prev => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
      setTotal(data.total);

    } catch (err) {
      console.error('Load more error:', err);
      setError('Failed to load more results');
    } finally {
      setIsLoading(false);
    }
  }, [cursor, isLoading, hasMore, initialLimit, query]);

  /**
   * Set query with debouncing
   */
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      search(newQuery);
    }, debounceMs);
  }, [search, debounceMs]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setQueryState('');
    setResults([]);
    setIsLoading(false);
    setError(null);
    setHasMore(false);
    setCursor(null);
    setTotal(0);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasMore,
    loadMore,
    cursor,
    total,
    search,
    reset
  };
}

/**
 * Hook for fetching hero options based on city pulse
 */
export function useHeroOptions() {
  const [options, setOptions] = useState<Array<{
    id: string;
    emoji: string;
    label: string;
    query: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [transitSpeed, setTransitSpeed] = useState(50);

  const fetchHeroOptions = useCallback(async (query?: string) => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      params.set('transitSpeed', transitSpeed.toString());

      const response = await fetch(`${API_BASE_URL}/api/places/hero?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch hero options');
      }

      const data = await response.json();
      setOptions(data.options);

    } catch (err) {
      console.error('Hero options error:', err);
      // Set default options on error
      setOptions([
        { id: '1', emoji: '🍝', label: 'Italian', query: 'italian restaurant cozy' },
        { id: '2', emoji: '🎭', label: 'Shows', query: 'theater entertainment live' },
        { id: '3', emoji: '🍺', label: 'Bars', query: 'bar drinks nightlife' },
        { id: '4', emoji: '🌳', label: 'Parks', query: 'outdoor park nature' }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [transitSpeed]);

  const updateTransitSpeed = useCallback((speed: number) => {
    setTransitSpeed(speed);
  }, []);

  return {
    options,
    isLoading,
    transitSpeed,
    fetchHeroOptions,
    updateTransitSpeed
  };
}

export default useVectorSearch;
