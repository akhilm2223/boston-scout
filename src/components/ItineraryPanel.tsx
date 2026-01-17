import { useState, useCallback, useEffect } from 'react';
import '@/components/ItineraryPanel.css';
import "@/App.css";
import StepOne from './StepOne'; 
import StepTwo from './StepTwo';
import { ItineraryEvent } from '../types'; 
import EventSearchPanel from './EventSearchPanel';
import { TripDates } from '../App';

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
}

export default function ItineraryPanel({ 
  onLocationClick, 
  handleAddToItinerary,
  onRemoveEvent,
  customEvents = [],
  tripDates,
  onTripDatesChange
}: ItineraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [items, setItems] = useState<ItineraryEvent[]>(customEvents);
  const [isSearching, setIsSearching] = useState(false);

  // Sync items with customEvents prop
  useEffect(() => {
    setItems(customEvents);
  }, [customEvents]);

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      // Reset searching state after a timeout to simulate loading "handoff"
      setTimeout(() => setIsSearching(false), 1000);
    }
  }, [searchQuery]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchSubmit();
  };

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
		<div className="w-full h-full bg-white flex flex-col relative overflow-hidden">
			<div className="flex flex-row space-x-5 p-2">
				<div className="text-2xl font-bold">Your Current Itinerary</div>
				<div>
					<button onClick={handlePrev} disabled={currentStep === 1}>
						Back
					</button>
					<button
						onClick={handleNext}
						disabled={currentStep === totalSteps || !validateStep(currentStep, tripDates)}
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
					<StepTwo data={formData} onChange={setFormData} />
				)}
				{currentStep === 3 && (
					<div className="dual-panel-container">
						{/* Discovery Column (4-Card Grid) */}
						<div className="discovery-column">
							<EventSearchPanel
								onAddToItinerary={handleAddToItinerary}
								onLocationClick={onLocationClick}
								activeSearchQuery={searchQuery}
							/>
						</div>

						{/* Itinerary Column */}
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
											onClick={() =>
												handleStopClick(stop)
											}
											draggable
											onDragStart={() =>
												handleDragStart(index)
											}
											onDragOver={(e) =>
												handleDragOver(e, index)
											}
											onDragEnd={handleDragEnd}
										>
											{/* Drag Handle */}
											<div
												className="drag-handle"
												title="Drag to reorder"
											>
												<span className="grip-dot"></span>
												<span className="grip-dot"></span>
												<span className="grip-dot"></span>
												<span className="grip-dot"></span>
												<span className="grip-dot"></span>
												<span className="grip-dot"></span>
											</div>

											{/* Item Content */}
											<div className="item-content">
												<span className="item-name">
													{stop.name}
												</span>
												{stop.time && (
													<span className="item-time">
														{stop.time}
													</span>
												)}
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
										{items.length}{" "}
										{items.length === 1
											? "experience"
											: "experiences"}
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Unified Search Bar - at bottom */}
			{currentStep === 3 && (
				<div className="global-search-container">
					<div className="search-wrapper">
						<input
							type="text"
							className="global-search-input"
							placeholder="Ask for experiences... (e.g. 'romantic dinner' or 'jazz concert')"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyPress={handleKeyPress}
						/>
						<button
							className="global-search-btn"
							onClick={handleSearchSubmit}
							disabled={isSearching}
						>
							{isSearching ? "..." : "→"}
						</button>
					</div>
				</div>
			)}
		</div>
  );
}
