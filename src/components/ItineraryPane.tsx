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
              className={`itinerary-item ${selectedStop === stop.id ? "selected" : ""} ${draggedIndex === index ? "dragging" : ""}`}
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
