import { ItineraryEvent } from '../types';
import EventSearchPanel from './EventSearchPanel';

interface DiscoveryPaneProps {
  onAddToItinerary: (event: ItineraryEvent) => void;
  onLocationClick: (location: [number, number], name: string) => void;
  activeSearchQuery: string;
}

export default function DiscoveryPane({
  onAddToItinerary,
  onLocationClick,
  activeSearchQuery,
}: DiscoveryPaneProps) {
  return (
    <div className="discovery-column">
      <EventSearchPanel
        onAddToItinerary={onAddToItinerary}
        onLocationClick={onLocationClick}
        activeSearchQuery={activeSearchQuery}
      />
    </div>
  );
}
