import { useState, useCallback, useRef, useEffect, CSSProperties } from 'react';
import { List, ListImperativeAPI } from 'react-window';
import VibePlaceCard from './VibePlaceCard';
import type { VectorSearchResult, EventSearchResult, UnifiedSearchResult } from '../types/vector';
import './VirtualDiscoveryList.css';

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
 * Event card component for rendering events
 */
function EventCard({ 
  event, 
  isAdded, 
  onAdd, 
  onSkip, 
  onClick, 
  style 
}: { 
  event: EventSearchResult;
  isAdded: boolean;
  onAdd: () => void;
  onSkip: () => void;
  onClick: () => void;
  style: CSSProperties;
}) {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div 
      className={`vibe-card event-card ${isAdded ? 'added' : ''}`} 
      style={style}
      onClick={onClick}
    >
      <div className="vibe-card-content">
        <div className="vibe-card-header">
          <span className="event-badge">🎭 Event</span>
          {event.category && (
            <span className="event-category">{event.category}</span>
          )}
        </div>
        <h3 className="vibe-card-title">{event.title}</h3>
        <div className="vibe-card-meta">
          <span className="event-date">📅 {formatDate(event.start_time)}</span>
          <span className="event-venue">📍 {event.venue.name}</span>
        </div>
        {event.price && (
          <span className="event-price">{event.price}</span>
        )}
      </div>
      <div className="vibe-card-actions">
        {!isAdded ? (
          <>
            <button 
              className="action-btn add-btn" 
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              title="Add to itinerary"
            >
              +
            </button>
            <button 
              className="action-btn skip-btn" 
              onClick={(e) => { e.stopPropagation(); onSkip(); }}
              title="Skip"
            >
              ×
            </button>
          </>
        ) : (
          <span className="added-badge">✓ Added</span>
        )}
      </div>
    </div>
  );
}

/**
 * Row component for virtual list
 */
function Row({ index, style, items, addedIds, onAddItem, onSkipItem, onItemClick }: RowComponentProps) {
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
  if (item.type === 'event') {
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
  emptyMessage = 'Search for places to discover'
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
    [hasMore, isLoading, items.length, onLoadMore]
  );

  // Item count
  const itemCount = items.length;

  // Item data for row renderer
  const rowProps: RowProps = {
    items,
    addedIds,
    onAddItem,
    onSkipItem,
    onItemClick
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
