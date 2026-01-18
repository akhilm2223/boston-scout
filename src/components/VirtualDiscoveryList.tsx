import { useState, useCallback, useRef, useEffect, CSSProperties } from "react";
import { List, ListImperativeAPI } from "react-window";
import VibePlaceCard from "./VibePlaceCard";
import type {
	VectorSearchResult,
	EventSearchResult,
	RedditSearchResult,
	LandmarkSearchResult,
	UnifiedSearchResult,
} from "../types/vector";
import "./VirtualDiscoveryList.css";

const ITEM_HEIGHT = 120;
const OVERSCAN_COUNT = 5;

export interface VirtualDiscoveryListProps {
	items: UnifiedSearchResult[];
	hasMore: boolean;
	isLoading: boolean;
	onLoadMore: () => Promise<void>;
	addedIds: Set<string>;
	onAddItem: (item: UnifiedSearchResult) => void;
	onSkipItem: (item: UnifiedSearchResult) => void;
	onItemClick: (item: UnifiedSearchResult) => void;
	height?: number;
	emptyMessage?: string;
}

interface RowProps {
	items: UnifiedSearchResult[];
	addedIds: Set<string>;
	onAddItem: (item: UnifiedSearchResult) => void;
	onSkipItem: (item: UnifiedSearchResult) => void;
	onItemClick: (item: UnifiedSearchResult) => void;
}

interface RowComponentProps extends RowProps {
	index: number;
	style: CSSProperties;
	ariaAttributes: {
		"aria-posinset": number;
		"aria-setsize": number;
		role: "listitem";
	};
}

/**
 * Event card component for rendering events - matches VibePlaceCard style
 */
function EventCard({
	event,
	isAdded,
	onAdd,
	onSkip,
	onClick,
	style,
}: {
	event: EventSearchResult;
	isAdded: boolean;
	onAdd: () => void;
	onSkip: () => void;
	onClick: () => void;
	style: CSSProperties;
}) {
	// Unused but available for future
	void onSkip;

	const formatDate = (dateStr: string) => {
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			});
		} catch {
			return dateStr;
		}
	};

	// Generate image URL - use event image or fallback to category-based Unsplash
	const getImageUrl = () => {
		if (event.image_url) return event.image_url;

		// Category-based fallback images
		const category = (event.category || "").toLowerCase();
		let searchTerm = "concert,event,boston";

		if (category.includes("music") || category.includes("concert")) {
			searchTerm = "concert,live-music,performance";
		} else if (category.includes("sport")) {
			searchTerm = "sports,stadium,game";
		} else if (category.includes("art") || category.includes("museum")) {
			searchTerm = "art,gallery,exhibition";
		} else if (category.includes("food") || category.includes("drink")) {
			searchTerm = "food,festival,dining";
		} else if (category.includes("comedy")) {
			searchTerm = "comedy,standup,theater";
		} else if (
			category.includes("theater") ||
			category.includes("theatre")
		) {
			searchTerm = "theater,stage,performance";
		}

		return `https://source.unsplash.com/400x300/?${searchTerm}`;
	};

	const imageUrl = getImageUrl();

	return (
		<div
			className={`vibe-place-card event-card ${isAdded ? "added" : ""}`}
			style={
				{
					...style,
					"--card-image": `url(${imageUrl})`,
				} as CSSProperties
			}
			onClick={onClick}
		>
			{/* Image Section (40% width) */}
			<div className="card-image-section">
				<div className="card-image" />
				{/* Event type badge on image */}
				<div className="event-type-badge">🎭 Event</div>
			</div>

			{/* Content Section (60% width) */}
			<div className="card-content-section">
				{/* Title */}
				<h3 className="card-title">{event.title}</h3>

				{/* Meta Row: Date & Venue */}
				<div className="card-meta">
					<span className="meta-date">
						📅 {formatDate(event.start_time)}
					</span>
				</div>

				{/* Venue as address */}
				<p className="card-address">📍 {event.venue.name}</p>

				{/* Category & Price as badge */}
				<div className="event-info-row">
					{event.category && (
						<span className="event-category-badge">
							{event.category}
						</span>
					)}
					{event.price && (
						<span className="event-price-badge">{event.price}</span>
					)}
				</div>
			</div>

			{/* Action Button */}
			<div className="card-actions">
				<button
					className={`action-btn add ${isAdded ? "added" : ""}`}
					onClick={(e) => {
						e.stopPropagation();
						onAdd();
					}}
					disabled={isAdded}
				>
					{isAdded ? "Added" : "Add"}
				</button>
			</div>

			{/* Added Badge */}
			{isAdded && (
				<div className="added-badge">
					<span>✓</span>
				</div>
			)}
		</div>
	);
}

/**
 * Reddit card component for rendering Reddit posts
 */
function RedditCard({
	post,
	isAdded,
	onAdd,
	onSkip,
	onClick,
	style,
}: {
	post: RedditSearchResult;
	isAdded: boolean;
	onAdd: () => void;
	onSkip: () => void;
	onClick: () => void;
	style: CSSProperties;
}) {
	void onSkip;

	// Generate image based on categories
	const getImageUrl = () => {
		const categories = post.categories || [];
		let searchTerm = "boston,city,hidden";

		if (categories.some((c) => c.toLowerCase().includes("food"))) {
			searchTerm = "restaurant,food,hidden-gem";
		} else if (
			categories.some(
				(c) =>
					c.toLowerCase().includes("bar") ||
					c.toLowerCase().includes("nightlife"),
			)
		) {
			searchTerm = "bar,cocktail,nightlife";
		} else if (
			categories.some(
				(c) =>
					c.toLowerCase().includes("music") ||
					c.toLowerCase().includes("concert"),
			)
		) {
			searchTerm = "concert,live-music,venue";
		} else if (
			categories.some(
				(c) =>
					c.toLowerCase().includes("outdoor") ||
					c.toLowerCase().includes("park"),
			)
		) {
			searchTerm = "park,nature,outdoor,boston";
		}

		return `https://source.unsplash.com/400x300/?${searchTerm}`;
	};

	const imageUrl = getImageUrl();

	return (
		<div
			className={`vibe-place-card reddit-card ${isAdded ? "added" : ""}`}
			style={
				{
					...style,
					"--card-image": `url(${imageUrl})`,
				} as CSSProperties
			}
			onClick={onClick}
		>
			{/* Image Section */}
			<div className="card-image-section">
				<div className="card-image" />
				<div className="reddit-type-badge">💎 Hidden</div>
			</div>

			{/* Content Section */}
			<div className="card-content-section">
				<h3 className="card-title">{post.title}</h3>

				<div className="card-meta">
					<span className="meta-subreddit">r/{post.subreddit}</span>
					<span className="meta-upvotes">⬆️ {post.ups}</span>
					<span className="meta-comments">
						💬 {post.num_comments}
					</span>
				</div>

				{post.text && (
					<p className="card-address">
						{post.text.substring(0, 80)}...
					</p>
				)}

				<div className="reddit-info-row">
					{post.isHiddenGem && (
						<span className="hidden-gem-badge">💎 Hidden Gem</span>
					)}
					{post.categories?.slice(0, 2).map((cat, i) => (
						<span key={i} className="reddit-category-badge">
							{cat}
						</span>
					))}
				</div>
			</div>

			{/* Action - Open Reddit */}
			<div className="card-actions">
				<a
					href={post.url}
					target="_blank"
					rel="noopener noreferrer"
					className="action-btn view-btn"
					onClick={(e) => e.stopPropagation()}
				>
					View
				</a>
			</div>
		</div>
	);
}

/**
 * Landmark card component for rendering landmarks
 */
function LandmarkCard({
	landmark,
	isAdded,
	onAdd,
	onSkip,
	onClick,
	style,
}: {
	landmark: LandmarkSearchResult;
	isAdded: boolean;
	onAdd: () => void;
	onSkip: () => void;
	onClick: () => void;
	style: CSSProperties;
}) {
	void onSkip;

	// Generate image based on landmark category - handle Google Places photo references
	const getImageUrl = () => {
		if (landmark.photo_name) {
			// Already a full URL
			if (landmark.photo_name.startsWith("http")) {
				return landmark.photo_name;
			}
			// New Google Places API format
			if (landmark.photo_name.startsWith("places/")) {
				return `https://places.googleapis.com/v1/${landmark.photo_name}/media?maxWidthPx=400&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
			}
			// Legacy photo reference format
			return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${landmark.photo_name}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
		}

		// Fallback to Unsplash based on category
		const category = (landmark.primary_category || "").toLowerCase();
		let searchTerm = "boston,landmark,historic";

		if (category.includes("museum")) {
			searchTerm = "museum,art,exhibition";
		} else if (category.includes("park") || category.includes("garden")) {
			searchTerm = "park,garden,nature,boston";
		} else if (
			category.includes("church") ||
			category.includes("historic")
		) {
			searchTerm = "historic,architecture,boston";
		} else if (
			category.includes("university") ||
			category.includes("college")
		) {
			searchTerm = "university,campus,harvard";
		} else if (category.includes("stadium") || category.includes("arena")) {
			searchTerm = "stadium,sports,boston";
		}

		return `https://source.unsplash.com/400x300/?${searchTerm}`;
	};

	const imageUrl = getImageUrl();

	// Format categories for display
	const displayCategory =
		landmark.primary_category || landmark.categories?.[0] || "Landmark";

	return (
		<div
			className={`vibe-place-card landmark-card ${isAdded ? "added" : ""}`}
			style={
				{
					...style,
					"--card-image": `url(${imageUrl})`,
				} as CSSProperties
			}
			onClick={onClick}
		>
			{/* Image Section */}
			<div className="card-image-section">
				<div className="card-image" />
				<div className="landmark-type-badge">🏛️ Landmark</div>
			</div>

			{/* Content Section */}
			<div className="card-content-section">
				<h3 className="card-title">{landmark.name}</h3>

				<div className="card-meta">
					{landmark.rating && (
						<span className="meta-rating">
							⭐ {landmark.rating.toFixed(1)}
						</span>
					)}
					{landmark.user_rating_count && (
						<span className="meta-reviews">
							({landmark.user_rating_count.toLocaleString()})
						</span>
					)}
				</div>

				<p className="card-address">📍 {landmark.address}</p>

				<div className="landmark-info-row">
					<span className="landmark-category-badge">
						{displayCategory}
					</span>
				</div>
			</div>

			{/* Action Button */}
			<div className="card-actions">
				<button
					className={`action-btn add ${isAdded ? "added" : ""}`}
					onClick={(e) => {
						e.stopPropagation();
						onAdd();
					}}
					disabled={isAdded}
				>
					{isAdded ? "Added" : "Add"}
				</button>
			</div>

			{/* Added Badge */}
			{isAdded && (
				<div className="added-badge">
					<span>✓</span>
				</div>
			)}
		</div>
	);
}

/**
 * Row component for virtual list
 */
function Row({
	index,
	style,
	items,
	addedIds,
	onAddItem,
	onSkipItem,
	onItemClick,
}: RowComponentProps) {
	const item = items[index];

	// Loading placeholder
	if (!item) {
		return (
			<div style={style} className="virtual-list-loading-row">
				<div className="loading-skeleton">
					<div className="skeleton-image" />
					<div className="skeleton-content">
						<div className="skeleton-title" />
						<div className="skeleton-meta" />
						<div className="skeleton-address" />
					</div>
				</div>
			</div>
		);
	}

	// Render event card for events
	if (item.type === "event") {
		return (
			<EventCard
				key={item._id}
				event={item as EventSearchResult}
				isAdded={addedIds.has(item._id)}
				onAdd={() => onAddItem(item)}
				onSkip={() => onSkipItem(item)}
				onClick={() => onItemClick(item)}
				style={style}
			/>
		);
	}

	// Render reddit card for reddit posts
	if (item.type === "reddit") {
		return (
			<RedditCard
				key={item._id}
				post={item as RedditSearchResult}
				isAdded={addedIds.has(item._id)}
				onAdd={() => onAddItem(item)}
				onSkip={() => onSkipItem(item)}
				onClick={() =>
					window.open((item as RedditSearchResult).url, "_blank")
				}
				style={style}
			/>
		);
	}

	// Render landmark card for landmarks
	if (item.type === "landmark") {
		return (
			<LandmarkCard
				key={item._id}
				landmark={item as LandmarkSearchResult}
				isAdded={addedIds.has(item._id)}
				onAdd={() => onAddItem(item)}
				onSkip={() => onSkipItem(item)}
				onClick={() => onItemClick(item)}
				style={style}
			/>
		);
	}

	// Render place card for places
	const place = item as VectorSearchResult;
	return (
		<VibePlaceCard
			key={place._id}
			place={place}
			isAdded={addedIds.has(place._id)}
			onAdd={() => onAddItem(item)}
			onSkip={() => onSkipItem(item)}
			onClick={() => onItemClick(item)}
			style={style}
		/>
	);
}

/**
 * Virtual scrolling container for discovery cards
 * Uses react-window for performance with 3000+ items
 */
export default function VirtualDiscoveryList({
	items,
	hasMore,
	isLoading,
	onLoadMore,
	addedIds,
	onAddItem,
	onSkipItem,
	onItemClick,
	height,
	emptyMessage = "Search for places to discover",
}: VirtualDiscoveryListProps) {
	const listRef = useRef<ListImperativeAPI | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerHeight, setContainerHeight] = useState(height || 400);
	const loadingRef = useRef(false);

	// Auto-measure container height
	useEffect(() => {
		if (!height && containerRef.current) {
			const resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					setContainerHeight(entry.contentRect.height);
				}
			});

			resizeObserver.observe(containerRef.current);
			return () => resizeObserver.disconnect();
		}
	}, [height]);

	// Load more when reaching end
	const handleRowsRendered = useCallback(
		(visibleRows: { startIndex: number; stopIndex: number }) => {
			if (
				hasMore &&
				!isLoading &&
				!loadingRef.current &&
				visibleRows.stopIndex >= items.length - 5
			) {
				loadingRef.current = true;
				onLoadMore().finally(() => {
					loadingRef.current = false;
				});
			}
		},
		[hasMore, isLoading, items.length, onLoadMore],
	);

	// Item count
	const itemCount = items.length;

	// Item data for row renderer
	const rowProps: RowProps = {
		items,
		addedIds,
		onAddItem,
		onSkipItem,
		onItemClick,
	};

	// Empty state
	if (items.length === 0 && !isLoading) {
		return (
			<div className="virtual-list-empty" ref={containerRef}>
				<div className="empty-state">
					<span className="empty-icon">🔍</span>
					<p className="empty-message">{emptyMessage}</p>
				</div>
			</div>
		);
	}

	// Loading state (initial)
	if (items.length === 0 && isLoading) {
		return (
			<div className="virtual-list-loading" ref={containerRef}>
				<div className="loading-state">
					<div className="spinner" />
					<p>Discovering places...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="virtual-discovery-list" ref={containerRef}>
			<List
				listRef={listRef}
				rowCount={itemCount}
				rowHeight={ITEM_HEIGHT}
				rowProps={rowProps}
				rowComponent={Row}
				overscanCount={OVERSCAN_COUNT}
				onRowsRendered={handleRowsRendered}
				className="virtual-list-inner"
				style={{ height: height || containerHeight }}
			/>

			{/* Loading indicator at bottom */}
			{isLoading && items.length > 0 && (
				<div className="list-loading-more">
					<div className="spinner-small" />
					<span>Loading more...</span>
				</div>
			)}
		</div>
	);
}
