import { useState, useCallback, useRef, useEffect } from "react";
import type {
	VectorSearchResult,
	EventSearchResult,
	VibeSearchResponse,
	EventVibeSearchResponse,
	InfiniteScrollResponse,
	SearchType,
	UnifiedSearchResult,
} from "../types/vector";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface UseVectorSearchOptions {
	debounceMs?: number;
	initialLimit?: number;
}

interface UseVectorSearchReturn {
	// Search state
	query: string;
	setQuery: (query: string) => void;
	results: UnifiedSearchResult[];
	isLoading: boolean;
	error: string | null;

	// Pagination
	hasMore: boolean;
	loadMore: () => Promise<void>;
	cursor: string | null;
	total: number;

	// Search type filter
	searchType: SearchType;
	setSearchType: (type: SearchType) => void;

	// Actions
	search: (query: string) => Promise<void>;
	reset: () => void;
}

/**
 * Hook for vector-based semantic search with debouncing and pagination
 */
export function useVectorSearch(
	options: UseVectorSearchOptions = {},
): UseVectorSearchReturn {
	const { debounceMs = 300, initialLimit = 10 } = options;

	// State
	const [query, setQueryState] = useState("");
	const [results, setResults] = useState<UnifiedSearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [cursor, setCursor] = useState<string | null>(null);
	const [total, setTotal] = useState(0);
	const [searchType, setSearchType] = useState<SearchType>("restaurants");

	// Refs for debouncing and caching
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const searchTypeRef = useRef<SearchType>(searchType);

	// Keep ref in sync
	useEffect(() => {
		searchTypeRef.current = searchType;
	}, [searchType]);

	/**
	 * Perform vector search
	 */
	const search = useCallback(
		async (searchQuery: string) => {
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
				const currentSearchType = searchTypeRef.current;

				if (currentSearchType === "transit") {
					// Transit mode - show MBTA stops/routes info
					// Transit is handled by the map layer, clear list results
					setResults([]);
					setTotal(0);
					setHasMore(false);
					setCursor(null);
					setIsLoading(false);
					return;
				} else if (currentSearchType === "events") {
					// Search events only
					const response = await fetch(
						`${API_BASE_URL}/api/events/vibe-search`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								query: searchQuery,
								limit: initialLimit,
							}),
							signal: abortControllerRef.current.signal,
						},
					);

					if (!response.ok) {
						throw new Error("Search failed");
					}

					const data: EventVibeSearchResponse = await response.json();
					const taggedResults: UnifiedSearchResult[] =
						data.results.map((e) => ({
							...e,
							type: "event" as const,
						}));

					setResults(taggedResults);
					setTotal(data.count);
					setHasMore(data.results.length >= initialLimit);
					setCursor(
						data.results.length > 0
							? data.results[data.results.length - 1]._id
							: null,
					);
				} else if (
					currentSearchType === "restaurants" ||
					currentSearchType === "landmarks"
				) {
					// Search places with type filter
					const placeType =
						currentSearchType === "restaurants"
							? "restaurant"
							: "landmark";
					const response = await fetch(
						`${API_BASE_URL}/api/places/vibe-search`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								query: searchQuery,
								limit: initialLimit,
								placeType: placeType,
							}),
							signal: abortControllerRef.current.signal,
						},
					);

					if (!response.ok) {
						throw new Error("Search failed");
					}

					const data: VibeSearchResponse = await response.json();
					const taggedResults: UnifiedSearchResult[] =
						data.results.map((p) => ({
							...p,
							type: "place" as const,
						}));

					setResults(taggedResults);
					setTotal(data.count);
					setHasMore(data.results.length >= initialLimit);
					setCursor(
						data.results.length > 0
							? data.results[data.results.length - 1]._id
							: null,
					);
				} else if (currentSearchType === "hidden") {
					// Search Reddit/hidden gems - get more since no pagination
					const response = await fetch(
						`${API_BASE_URL}/api/reddit/vibe-search`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								query: searchQuery,
								limit: 50, // Get more results at once since no pagination
								filters: { hiddenGemsOnly: false },
							}),
							signal: abortControllerRef.current.signal,
						},
					);

					if (!response.ok) {
						throw new Error("Search failed");
					}

					const data = await response.json();
					const taggedResults: UnifiedSearchResult[] =
						data.results.map((r: any) => ({
							...r,
							type: "reddit" as const,
						}));

					setResults(taggedResults);
					setTotal(data.count);
					setHasMore(false); // Reddit doesn't support pagination - show all at once
					setCursor(null);
				} else if (currentSearchType === "all") {
					// Search ALL categories - unified search
					const response = await fetch(
						`${API_BASE_URL}/api/search/unified`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								query: searchQuery,
								limit: 15, // Per category
							}),
							signal: abortControllerRef.current.signal,
						},
					);

					if (!response.ok) {
						throw new Error("Search failed");
					}

					const data = await response.json();

					// Combine all results with their types already set by server
					// Priority order: landmarks > places > events > reddit
					const allResults: UnifiedSearchResult[] = [
						...(data.landmarks?.results || []),
						...data.places.results,
						...data.events.results,
						...data.reddit.results,
					];

					setResults(allResults);
					setTotal(
						data.places.count +
							data.events.count +
							(data.landmarks?.count || 0) +
							data.reddit.count,
					);
					setHasMore(false); // Unified search doesn't support pagination
					setCursor(null);
				}
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") {
					// Request was cancelled, ignore
					return;
				}
				console.error("Vector search error:", err);
				setError("Failed to search. Please try again.");
			} finally {
				setIsLoading(false);
			}
		},
		[initialLimit],
	);

	/**
	 * Load more results (pagination)
	 */
	const loadMore = useCallback(async () => {
		if (!cursor || isLoading || !hasMore) return;

		// Validate cursor is a valid ObjectId format (24 hex chars)
		if (!/^[0-9a-fA-F]{24}$/.test(cursor)) {
			console.warn("Invalid cursor format, skipping loadMore:", cursor);
			setHasMore(false);
			return;
		}

		setIsLoading(true);

		try {
			const params = new URLSearchParams({
				cursor,
				limit: initialLimit.toString(),
			});

			// Only add query if it's not empty
			if (query && query.trim()) {
				params.set("query", query.trim());
			}

			const infiniteResponse = await fetch(
				`${API_BASE_URL}/api/places/infinite?${params}`,
			);

			if (!infiniteResponse.ok) {
				const errorData = await infiniteResponse
					.json()
					.catch(() => ({}));
				console.error("Infinite scroll error:", errorData);
				throw new Error("Failed to load more results");
			}

			const data: InfiniteScrollResponse = await infiniteResponse.json();

			// Tag items with type before adding to results
			const taggedItems: UnifiedSearchResult[] = data.items.map(
				(item) => ({ ...item, type: "place" as const }),
			);
			setResults((prev) => [...prev, ...taggedItems]);
			setHasMore(data.hasMore);
			setCursor(data.nextCursor);
			setTotal(data.total);
		} catch (err) {
			console.error("Load more error:", err);
			setHasMore(false); // Stop trying to load more on error
		} finally {
			setIsLoading(false);
		}
	}, [cursor, isLoading, hasMore, initialLimit, query]);

	/**
	 * Set query with debouncing
	 */
	const setQuery = useCallback(
		(newQuery: string) => {
			setQueryState(newQuery);

			// Clear existing timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			// Set new timer for debounced search
			debounceTimerRef.current = setTimeout(() => {
				search(newQuery);
			}, debounceMs);
		},
		[search, debounceMs],
	);

	/**
	 * Reset all state
	 */
	const reset = useCallback(() => {
		setQueryState("");
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

	// Re-search when search type changes
	useEffect(() => {
		if (query) {
			search(query);
		}
	}, [searchType]); // eslint-disable-line react-hooks/exhaustive-deps

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
		searchType,
		setSearchType,
		search,
		reset,
	};
}

/**
 * Hook for fetching hero options based on city pulse
 */
export function useHeroOptions() {
	const [options, setOptions] = useState<
		Array<{
			id: string;
			emoji: string;
			label: string;
			query: string;
		}>
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [transitSpeed, setTransitSpeed] = useState(50);

	const fetchHeroOptions = useCallback(
		async (query?: string) => {
			setIsLoading(true);

			try {
				const params = new URLSearchParams();
				if (query) params.set("query", query);
				params.set("transitSpeed", transitSpeed.toString());

				const response = await fetch(
					`${API_BASE_URL}/api/places/hero?${params}`,
				);

				if (!response.ok) {
					throw new Error("Failed to fetch hero options");
				}

				const data = await response.json();
				setOptions(data.options);
			} catch (err) {
				console.error("Hero options error:", err);
				// Set default options on error
				setOptions([
					{
						id: "1",
						emoji: "🍝",
						label: "Italian",
						query: "italian restaurant cozy",
					},
					{
						id: "2",
						emoji: "🎭",
						label: "Shows",
						query: "theater entertainment live",
					},
					{
						id: "3",
						emoji: "🍺",
						label: "Bars",
						query: "bar drinks nightlife",
					},
					{
						id: "4",
						emoji: "🌳",
						label: "Parks",
						query: "outdoor park nature",
					},
				]);
			} finally {
				setIsLoading(false);
			}
		},
		[transitSpeed],
	);

	const updateTransitSpeed = useCallback((speed: number) => {
		setTransitSpeed(speed);
	}, []);

	return {
		options,
		isLoading,
		transitSpeed,
		fetchHeroOptions,
		updateTransitSpeed,
	};
}

export default useVectorSearch;
