import { useState, useCallback, useEffect, useRef } from "react";
import "@/components/ItineraryPanel.css";
import "@/App.css";
import StepOne from "./StepOne";
import StepTwo from "./StepTwo";
import StepFour from "./StepFour";
import { ItineraryEvent } from "../types";
import DiscoveryPane, { DiscoveryPaneRef } from "./DiscoveryPane";
import ItineraryPane from "./ItineraryPane";
import SearchBar from "./SearchBar";
import { TripDates, WalkingPreferences } from "../App";
import { useVoiceOnboarding } from "../hooks/useVoiceOnboarding";

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
	voiceOnboardingActive: boolean;
	onVoiceOnboardingComplete: () => void;
	setLayerVisibility: (
		layer: "places" | "events" | "landmarks",
		visible: boolean,
	) => void;
	onMapControl?: (
		action: "zoom_in" | "zoom_out" | "fly_to",
		location?: string,
	) => void;
	onItineraryRouteUpdate?: (routeData: any) => void;
}

export default function ItineraryPanel({
	onLocationClick,
	handleAddToItinerary,
	onRemoveEvent,
	customEvents = [],
	tripDates,
	onTripDatesChange,
	walkingPreferences,
	onWalkingPreferencesChange,
	voiceOnboardingActive,
	onVoiceOnboardingComplete,
	setLayerVisibility,
	onMapControl,
	onItineraryRouteUpdate,
}: ItineraryPanelProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedStop, setSelectedStop] = useState<string | null>(null);
	const [currentStep, setCurrentStep] = useState(1);
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [items, setItems] = useState<ItineraryEvent[]>(customEvents);
	const [isSearching, setIsSearching] = useState(false);
	const discoveryPaneRef = useRef<DiscoveryPaneRef>(null);

	// Voice onboarding hook
	const voiceOnboarding = useVoiceOnboarding({
		onTripDatesChange,
		onWalkingPreferencesChange,
		onInterestsSelected: (interests: string[]) => {
			console.log("[ItineraryPanel] User selected interests:", interests);

			// Turn OFF all layers first
			setLayerVisibility("places", false);
			setLayerVisibility("events", false);
			setLayerVisibility("landmarks", false);

			// Turn ON the requested layers
			interests.forEach((interest) => {
				if (interest === "events") {
					console.log("[ItineraryPanel] Enabling EVENTS layer");
					setLayerVisibility("events", true);
				} else if (
					interest === "restaurants" ||
					interest === "places"
				) {
					console.log(
						"[ItineraryPanel] Enabling PLACES layer (restaurants)",
					);
					setLayerVisibility("places", true);
				} else if (interest === "landmarks") {
					console.log("[ItineraryPanel] Enabling LANDMARKS layer");
					setLayerVisibility("landmarks", true);
				} else if (interest === "hidden") {
					// Hidden gems - search in discovery
					console.log("[ItineraryPanel] Searching for hidden gems");
					setSearchQuery("hidden gem local secret");
					setCurrentStep(3);
					// Also trigger the search
					setTimeout(
						() =>
							discoveryPaneRef.current?.triggerSearch(
								"hidden gem local secret",
							),
						100,
					);
				}
			});

			// Also navigate to step 3 (Discovery) automatically
			setCurrentStep(3);
		},
		onSearchQuery: (query: string) => {
			console.log("[ItineraryPanel] Voice search:", query);
			setSearchQuery(query);
			setCurrentStep(3);
			// Trigger the search immediately
			setTimeout(
				() => discoveryPaneRef.current?.triggerSearch(query),
				100,
			);
		},
		onNavigate: (destination) => {
			console.log("[ItineraryPanel] Voice navigation to:", destination);
			if (destination === "map") {
				// The map is always visible on the right - just acknowledge
				console.log(
					"[ItineraryPanel] Map is visible on the right panel",
				);
			} else if (destination === "discovery") {
				setCurrentStep(3);
			} else if (destination === "itinerary") {
				setCurrentStep(3);
			}
		},
		onMapControl: (action, location) => {
			console.log("[ItineraryPanel] Map control:", action, location);
			if (onMapControl) {
				onMapControl(action, location);
			}
		},
		onAddToItinerary: (placeName) => {
			console.log(
				"[ItineraryPanel] Add to itinerary (by name):",
				placeName,
			);
			// Search for the place and add the first result
			setSearchQuery(placeName);
			setCurrentStep(3);
			setTimeout(
				() => discoveryPaneRef.current?.triggerSearch(placeName),
				100,
			);
		},
		onComplete: onVoiceOnboardingComplete,
	});

	// Start voice onboarding when activated
	useEffect(() => {
		console.log(
			"[Voice] voiceOnboardingActive:",
			voiceOnboardingActive,
			"voiceOnboarding.isActive:",
			voiceOnboarding.isActive,
		);
		if (voiceOnboardingActive && !voiceOnboarding.isActive) {
			console.log("[Voice] Starting voice onboarding...");
			voiceOnboarding.start();
		}
	}, [voiceOnboardingActive, voiceOnboarding]);

	// Stop voice onboarding when reaching StepFour (final itinerary view)
	useEffect(() => {
		if (currentStep === 4 && voiceOnboarding.isActive) {
			console.log("[Voice] Stopping voice onboarding - reached StepFour");
			voiceOnboarding.stop();
			onVoiceOnboardingComplete();
		}
	}, [currentStep, voiceOnboarding, onVoiceOnboardingComplete]);

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
		onLocationClick([stop.location.lng, stop.location.lat], stop.name);
	};

	const totalSteps = 4;

	const handleNext = () => {
		if (validateStep(currentStep, tripDates)) {
			setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
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
		setCurrentStep((prev) => Math.max(prev - 1, 1));
	};

	return (
		<div className="w-full h-full bg-(--bg-primary) flex flex-col relative overflow-hidden transition-colors duration-300">
			{/* Voice assistant floating bar */}
			{voiceOnboarding.isActive && (
				<div className="absolute bottom-20 left-4 right-4 z-50">
					<div className="bg-black/90 backdrop-blur-md rounded-xl border border-cyan-500/30 p-4 shadow-lg">
						<div className="flex items-center gap-4">
							{/* Status indicator */}
							<div className="flex-shrink-0">
								{voiceOnboarding.voiceState === "listening" && (
									<div className="w-12 h-12 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center animate-pulse">
										<svg
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											className="text-cyan-500"
										>
											<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
											<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
											<line
												x1="12"
												x2="12"
												y1="19"
												y2="22"
											/>
										</svg>
									</div>
								)}
								{voiceOnboarding.voiceState === "speaking" && (
									<div className="w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
										<svg
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											className="text-green-500 animate-pulse"
										>
											<path d="M2 10v3" />
											<path d="M6 6v11" />
											<path d="M10 3v18" />
											<path d="M14 8v7" />
											<path d="M18 5v13" />
											<path d="M22 10v3" />
										</svg>
									</div>
								)}
								{voiceOnboarding.voiceState ===
									"processing" && (
									<div className="w-12 h-12 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center">
										<svg
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											className="text-yellow-500 animate-spin"
										>
											<path d="M21 12a9 9 0 1 1-6.219-8.56" />
										</svg>
									</div>
								)}
								{voiceOnboarding.voiceState === "idle" && (
									<div className="w-12 h-12 rounded-full bg-gray-500/20 border-2 border-gray-500 flex items-center justify-center">
										<svg
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											className="text-gray-400"
										>
											<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
											<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
										</svg>
									</div>
								)}
							</div>

							{/* Content */}
							<div className="flex-1 min-w-0">
								{voiceOnboarding.currentQuestion ? (
									<p className="text-white font-medium text-sm truncate">
										{voiceOnboarding.currentQuestion.text}
									</p>
								) : (
									<div>
										<p className="text-cyan-400 text-sm">
											{voiceOnboarding.voiceState ===
											"listening"
												? "🎤 Listening... speak now!"
												: voiceOnboarding.isPushToTalk
													? "🎤 Release space when done"
													: "⌨️ Hold SPACE to speak"}
										</p>
										<p className="text-gray-500 text-xs mt-1">
											Try: "zoom into Chinatown", "show me
											bars", "indian food"
										</p>
									</div>
								)}

								{voiceOnboarding.currentTranscript && (
									<p className="text-cyan-300 text-xs italic truncate mt-1">
										"{voiceOnboarding.currentTranscript}"
									</p>
								)}

								{voiceOnboarding.error && (
									<p className="text-red-400 text-xs mt-1">
										{voiceOnboarding.error}
									</p>
								)}
							</div>

							{/* Progress or Close */}
							<div className="flex-shrink-0 text-right">
								{voiceOnboarding.progress ? (
									<span className="text-gray-400 text-xs">
										{voiceOnboarding.progress.current}/
										{voiceOnboarding.progress.total}
									</span>
								) : (
									<button
										onClick={() => voiceOnboarding.stop()}
										className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10"
									>
										✕ Close
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			<div className="flex flex-row space-x-5 p-2 place-content-between">
				<div className="text-2xl font-bold text-(--text-primary) transition-colors duration-300">
					Boston Scout
				</div>
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
						disabled={
							currentStep === totalSteps ||
							!validateStep(currentStep, tripDates)
						}
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
						onChange={(newData) =>
							onTripDatesChange(newData as TripDates)
						}
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
							onLocationClick={onLocationClick}
							onRemoveEvent={onRemoveEvent}
							draggedIndex={draggedIndex}
							onDragStart={handleDragStart}
							onDragOver={handleDragOver}
							onDragEnd={handleDragEnd}
						/>
					</div>
				)}
				{currentStep === 4 && (
					<StepFour
						items={items}
						tripDates={tripDates}
						onBack={handlePrev}
						onItineraryRouteUpdate={onItineraryRouteUpdate}
					/>
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
