import { useState } from 'react';
import './ItineraryPanel.css';

interface ItineraryStop {
  id: string;
  name: string;
  location: [number, number]; // [lng, lat]
  time: string;
  duration: string;
  vibe: string;
  sentiment: 'positive' | 'neutral' | 'warning';
  category: 'transit' | 'food' | 'attraction' | 'university' | 'event';
  isCustom?: boolean;
}

interface ItineraryPanelProps {
  onLocationClick: (location: [number, number], name: string) => void;
  customEvents?: ItineraryStop[];
  onRemoveEvent?: (eventId: string) => void;
}

export default function ItineraryPanel({ onLocationClick, customEvents = [], onRemoveEvent }: ItineraryPanelProps) {
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [items, setItems] = useState<ItineraryStop[]>(customEvents);

  // Sync items with customEvents prop
  if (JSON.stringify(items.map(i => i.id)) !== JSON.stringify(customEvents.map(e => e.id))) {
    setItems(customEvents.map(e => ({ ...e, isCustom: true })));
  }

  const handleStopClick = (stop: ItineraryStop) => {
    setSelectedStop(stop.id);
    onLocationClick(stop.location, stop.name);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setItems(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (items.length === 0) {
    return (
      <div className="itinerary-panel-v2">
        <div className="empty-itinerary-v2">
          <span className="empty-icon">📋</span>
          <p className="empty-title">No events yet</p>
          <p className="empty-hint">Search and add events →</p>
        </div>
      </div>
    );
  }

  return (
    <div className="itinerary-panel-v2">
      <div className="itinerary-list">
        {items.map((stop, index) => (
          <div
            key={stop.id}
            className={`itinerary-item ${selectedStop === stop.id ? 'selected' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
            onClick={() => handleStopClick(stop)}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
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
        <div className="item-count">{items.length} {items.length === 1 ? 'experience' : 'experiences'}</div>
      </div>
    </div>
  );
}
