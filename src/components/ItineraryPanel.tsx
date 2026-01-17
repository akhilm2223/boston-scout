import { useState } from 'react';
import '@/components/ItineraryPanel.css';
import StepOne from './StepOne'; 
import StepTwo from './StepTwo';
import { ItineraryEvent } from '../types';
import EventSearchPanel from './EventSearchPanel';
import RestaurantSearchPanel from './RestaurantSearchPanel';

function validateStep(step: number, data: Record<string, any>): boolean {
  // Placeholder validation logic
  return true;
}

interface ItineraryPanelProps {
  dates: { start: Date; end: Date };
  onLocationClick: (location: [number, number], name: string) => void;
  handleAddToItinerary: (event: ItineraryEvent) => void;
  handleRemoveFromItinerary: (eventId: string) => void;
  customEvents?: ItineraryEvent[];
}

export default function ItineraryPanel({ 
  dates, 
  onLocationClick, 
  handleAddToItinerary,
  handleRemoveFromItinerary,
  customEvents = []
}: ItineraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState<'events' | 'restaurants'>('events');

  const handleStopClick = (stop: ItineraryEvent) => {
    setSelectedStop(stop.id);
    onLocationClick([stop.location.lat, stop.location.lng], stop.name);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'transit': return '🚆';
      case 'food': return '🍝';
      case 'attraction': return '🏛️';
      case 'university': return '🎓';
      default: return '📍';
    }
  };

  const totalSteps = 4;

  const handleNext = () => {
    if (validateStep(currentStep, formData)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    } else {
      setErrors(errors => ({ ...errors, [currentStep]: 'Please fix errors before proceeding.' }));
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  
  return (
		<div className="w-full h-full bg-white flex flex-col relative overflow-hidden">
			<div className="p-2">
				<div className="text-2xl font-bold">Your Current Itinerary</div>
			</div>
			<div className="flex overflow-auto relative">
				{currentStep === 1 && (
					<StepOne data={formData} onChange={setFormData} />
				)}
				{currentStep === 2 && (
					<StepTwo data={formData} onChange={setFormData} />
				)}
				{currentStep === 3 && (
					<div className="w-full h-full flex flex-row">
						<div className="space-y-2 p-2 flex flex-col w-full overflow-auto relative">
							{filteredStops.map((stop, index) => (
								<div
									key={stop.id}
									className={`relative cursor-pointer transition-all duration-300 ease-in-out px-4 py-5 rounded-lg border ${selectedStop === stop.id ? "selected" : ""} ${stop.sentiment}`}
									onClick={() => handleStopClick(stop)}
								>
									<div className="flex flex-col gap-2">
										<div className="">
											<h3 className="">{stop.name}</h3>
											<span className="">
												{stop.time}
											</span>
										</div>

										<div className="">
											<span className="">
												{stop.duration}
											</span>
											<span className="">
												{stop.description}
											</span>
										</div>

										<div className={""}>
											{stop.sentiment === "positive"
												? "✓ Recommended"
												: stop.sentiment === "warning"
													? "⚠ Check timing"
													: "ℹ Info"}
										</div>
									</div>
								</div>
							))}
							<div className="px-6 py-5 sticky bottom-0 bg-white">
								<input
									type="text"
									className="w-full px-3.5 py-4 border rounded-lg transition-all duration-300 ease-in-out"
									placeholder="Search locations..."
									value={searchQuery}
									onChange={(e) =>
										setSearchQuery(e.target.value)
									}
								/>
							</div>
						</div>
						<div className="flex flex-col w-full h-full">
							<div></div>
						</div>
					</div>
				)}
				{currentStep === 3 && (
					<div>
						<div className="">
							{/* Results Column */}
							<div className="">
								{/* Tab Header */}
								<div className="">
									<button
										className={`${activeTab === "events" ? "active" : ""}`}
										onClick={() => setActiveTab("events")}
									>
										<span className="tab-icon">🎫</span>
										Events
									</button>
									<button
										className={`tab-btn ${activeTab === "restaurants" ? "active" : ""}`}
										onClick={() =>
											setActiveTab("restaurants")
										}
									>
										<span className="tab-icon">🍽️</span>
										Restaurants
									</button>
								</div>

								{/* Tab Content */}
								{activeTab === "events" ? (
									<EventSearchPanel
										onAddToItinerary={handleAddToItinerary}
										onLocationClick={handleLocationClick}
									/>
								) : (
									<RestaurantSearchPanel
										onAddToItinerary={handleAddToItinerary}
										onLocationClick={handleLocationClick}
									/>
								)}
							</div>

							{/* Itinerary Column */}
							<div className="itinerary-column">
								<div className="column-header">
									<span className="header-icon">📋</span>
									<h2>Itinerary</h2>
									{customEvents.length > 0 && (
										<span className="event-count">
											{customEvents.length}
										</span>
									)}
								</div>
								<div className="itinerary-list">
									{customEvents.map((event) => (
										<div key={event.id} className="itinerary-item">
											<div className="event-name">{event.name}</div>
											<button 
												onClick={() => handleRemoveFromItinerary(event.id)}
												className="remove-btn"
											>
												×
											</button>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			<div>
				<button onClick={handlePrev} disabled={currentStep === 1}>
					Back
				</button>
				<button
					onClick={handleNext}
					disabled={currentStep === totalSteps}
				>
					Next
				</button>
			</div>
		</div>
  );
}
