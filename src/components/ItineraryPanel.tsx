import { useState, useCallback, useEffect, useRef } from 'react';
import '@/components/ItineraryPanel.css';
import "@/App.css";
import StepOne from './StepOne'; 
import StepTwo from './StepTwo';
import { ItineraryEvent } from '../types'; 
import DiscoveryPane, { DiscoveryPaneRef } from './DiscoveryPane';
import ItineraryPane from './ItineraryPane';
import SearchBar from './SearchBar';
import { TripDates, WalkingPreferences } from '../App';

function validateStep(step: number, tripDates: TripDates): boolean {
  if (step === 1) {
    // Require both start and end dates to be specified
    return !!(tripDates.startDate && tripDates.endDate);
  }
  return true;
}

interface ItineraryPanelProps {
  onLocationClick: (location: [number, number], name: string) => void;
  handleAddToItinerary: (event: ItineraryEvent) => void;
  onRemoveEvent: (eventId: string) => void;
  customEvents?: ItineraryEvent[];
  tripDates: TripDates;
  onTripDatesChange: (dates: TripDates) => void;
  walkingPreferences: WalkingPreferences;
  onWalkingPreferencesChange: (prefs: WalkingPreferences) => void;
}

export default function ItineraryPanel({ 
  onLocationClick, 
  handleAddToItinerary,
  onRemoveEvent,
  customEvents = [],
  tripDates,
  onTripDatesChange,
  walkingPreferences,
  onWalkingPreferencesChange
}: ItineraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [items, setItems] = useState<ItineraryEvent[]>(customEvents);
  const [isSearching, setIsSearching] = useState(false);
  const discoveryPaneRef = useRef<DiscoveryPaneRef>(null);

  // Sync items with customEvents prop
  useEffect(() => {
    setItems(customEvents);
  }, [customEvents]);

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      // Trigger immediate search via ref
      discoveryPaneRef.current?.triggerSearch(searchQuery);
      // Reset searching state after search completes
      setTimeout(() => setIsSearching(false), 500);
    }
  }, [searchQuery]);

  const handleStopClick = (stop: ItineraryEvent) => {
    setSelectedStop(stop.id);
    onLocationClick([stop.location.lat, stop.location.lng], stop.name);
  };

  const totalSteps = 4;

  const handleNext = () => {
    if (validateStep(currentStep, tripDates)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
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

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  
  return (
		<div className="w-full h-full bg-(--bg-primary) flex flex-col relative overflow-hidden transition-colors duration-300">
			<div className="flex flex-row space-x-5 p-2">
				<div className="text-2xl font-bold text-(--text-primary) transition-colors duration-300">Your Current Itinerary</div>
				<div>
					<button 
						onClick={handlePrev} 
						disabled={currentStep === 1}
						className="px-3 py-1 mr-2 bg-(--bg-secondary) text-(--text-primary) border border-(--border-primary) rounded hover:bg-(--bg-hover) disabled:opacity-50 transition-colors duration-300"
					>
						Back
					</button>
					<button
						onClick={handleNext}
						disabled={currentStep === totalSteps || !validateStep(currentStep, tripDates)}
						className="px-3 py-1 bg-(--accent) text-(--text-inverse) rounded hover:bg-(--accent-hover) disabled:opacity-50 transition-colors duration-300"
					>
						Next
					</button>
				</div>
			</div>
			<div className="flex overflow-auto relative flex-1">
			{currentStep === 1 && (
					<StepOne 
						data={tripDates} 
						onChange={(newData) => onTripDatesChange(newData as TripDates)} 
					/>
				)}
				{currentStep === 2 && (
					<StepTwo 
						data={walkingPreferences} 
						onChange={onWalkingPreferencesChange} 
					/>
				)}
				{currentStep === 3 && (
					<div className="dual-panel-container">
						{/* Discovery Pane - Left Side */}
						<DiscoveryPane
							ref={discoveryPaneRef}
							onAddToItinerary={handleAddToItinerary}
							onLocationClick={onLocationClick}
							activeSearchQuery={searchQuery}
							onSearchStateChange={setIsSearching}
						/>

						{/* Itinerary Pane - Right Side */}
						<ItineraryPane
							items={items}
							selectedStop={selectedStop}
							onStopClick={handleStopClick}
							onRemoveEvent={onRemoveEvent}
							draggedIndex={draggedIndex}
							onDragStart={handleDragStart}
							onDragOver={handleDragOver}
							onDragEnd={handleDragEnd}
						/>
					</div>
				)}
			</div>

			{/* Search Bar - at bottom for Step 3 */}
			{currentStep === 3 && (
				<SearchBar
					searchQuery={searchQuery}
					onSearchQueryChange={setSearchQuery}
					onSearchSubmit={handleSearchSubmit}
					isSearching={isSearching}
				/>
			)}
		</div>
  );
}
