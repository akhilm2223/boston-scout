import { useState, useCallback, useRef, useEffect, CSSProperties } from 'react';
import { List, ListImperativeAPI } from 'react-window';
import VibePlaceCard from './VibePlaceCard';
import type { VectorSearchResult } from '../types/vector';
import './VirtualDiscoveryList.css';

const ITEM_HEIGHT = 120;
const OVERSCAN_COUNT = 5;

export interface VirtualDiscoveryListProps {
  items: VectorSearchResult[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => Promise<void>;
  addedIds: Set<string>;
  onAddPlace: (place: VectorSearchResult) => void;
  onSkipPlace: (place: VectorSearchResult) => void;
  onPlaceClick: (place: VectorSearchResult) => void;
  height?: number;
  emptyMessage?: string;
}

interface RowProps {
  items: VectorSearchResult[];
  addedIds: Set<string>;
  onAddPlace: (place: VectorSearchResult) => void;
  onSkipPlace: (place: VectorSearchResult) => void;
  onPlaceClick: (place: VectorSearchResult) => void;
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
 * Row component for virtual list
 */
function Row({ index, style, items, addedIds, onAddPlace, onSkipPlace, onPlaceClick }: RowComponentProps) {
  const place = items[index];

  // Loading placeholder
  if (!place) {
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

  return (
    <VibePlaceCard
      key={place._id}
      place={place}
      isAdded={addedIds.has(place._id)}
      onAdd={onAddPlace}
      onSkip={onSkipPlace}
      onClick={onPlaceClick}
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
  onAddPlace,
  onSkipPlace,
  onPlaceClick,
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
    onAddPlace,
    onSkipPlace,
    onPlaceClick
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
