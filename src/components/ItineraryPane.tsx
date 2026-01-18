import { useState, useEffect, useRef } from 'react';
import { ItineraryEvent } from '../types';
import './ItineraryPane.css';

interface ItineraryPaneProps {
  items: ItineraryEvent[];
  selectedStop: string | null;
  onStopClick: (stop: ItineraryEvent) => void;
  onRemoveEvent: (eventId: string) => void;
  draggedIndex: number | null;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
}

export default function ItineraryPane({
  items,
  selectedStop,
  onStopClick,
  onRemoveEvent,
  draggedIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ItineraryPaneProps) {
  // Track new items for animation
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef<ItineraryEvent[]>([]);

  // Detect newly added items
  useEffect(() => {
    const prevIds = new Set(prevItemsRef.current.map(item => item.id));
    const currentIds = new Set(items.map(item => item.id));

    // Find new IDs (in current but not in previous)
    const newIds: string[] = [];
    currentIds.forEach(id => {
      if (!prevIds.has(id)) {
        newIds.push(id);
      }
    });

    if (newIds.length > 0) {
      setNewItemIds(new Set(newIds));

      // Remove new-item class after animation completes
      const timer = setTimeout(() => {
        setNewItemIds(new Set());
      }, 500); // Match animation duration

      return () => clearTimeout(timer);
    }

    prevItemsRef.current = items;
  }, [items]);

  return (
    <div className="itinerary-column">
      <div className="column-header">
        <h2>Your Itinerary</h2>
      </div>
      <div className="itinerary-panel-v2">
        <div className="itinerary-list">
          {items.map((stop, index) => (
            <div
              key={stop.id}
              className={`itinerary-item ${selectedStop === stop.id ? "selected" : ""} ${draggedIndex === index ? "dragging" : ""} ${newItemIds.has(stop.id) ? "new-item" : ""}`}
              onClick={() => onStopClick(stop)}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={onDragEnd}
            >
              {/* Drag Handle */}
              <div className="drag-handle" title="Drag to reorder">
                <span className="grip-dot"></span>
                <span className="grip-dot"></span>
                <span className="grip-dot"></span>
                <span className="grip-dot"></span>
                <span className="grip-dot"></span>
                <span className="grip-dot"></span>
              </div>

              {/* Item Content */}
              <div className="item-content">
                <span className="item-name">{stop.name}</span>
                {stop.time && <span className="item-time">{stop.time}</span>}
              </div>

              {/* Remove Button */}
              {onRemoveEvent && (
                <button
                  className="remove-btn-v2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveEvent(stop.id);
                  }}
                  title="Remove from itinerary"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="itinerary-footer">
          <div className="item-count">
            {items.length} {items.length === 1 ? "experience" : "experiences"}
          </div>
        </div>
      </div>
    </div>
  );
}
