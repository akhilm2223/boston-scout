import { useState } from 'react';
import './ItineraryPanel.css';
import StepOne from './StepOne'; 
import StepTwo from './StepTwo';
import StepThree from './StepThree';
import StepFour from './StepFour';

function validateStep(step: number, data: Record<string, any>): boolean {
  // Placeholder validation logic
  return true;
}

interface ItineraryStop {
  id: string;
  name: string;
  location: [number, number]; // [lng, lat]
  time: string;
  duration: string;
  description: string;
  sentiment: 'positive' | 'neutral' | 'warning';
  category: 'transit' | 'food' | 'attraction' | 'university';
}

interface ItineraryPanelProps {
  dates: { start: Date; end: Date };
  onLocationClick: (location: [number, number], name: string) => void;
}

const ITINERARY_DATA: ItineraryStop[] = [
  {
    id: 'wpi-start',
    name: 'WPI Campus',
    location: [-71.8023, 42.2626],
    time: '9:00 AM',
    duration: '30 min',
    description: 'Starting point - Worcester',
    sentiment: 'positive',
    category: 'university',
  },
  {
    id: 'commuter-rail',
    name: 'Worcester Line → Boston',
    location: [-71.4, 42.3],
    time: '9:30 AM',
    duration: '75 min',
    description: 'Express to Boston - scenic route',
    sentiment: 'positive',
    category: 'transit',
  },
  {
    id: 'back-bay',
    name: 'Back Bay Station',
    location: [-71.0752, 42.3478],
    time: '10:45 AM',
    duration: '10 min',
    description: 'Arrival - central Boston hub',
    sentiment: 'positive',
    category: 'transit',
  },
  {
    id: 'prudential',
    name: 'Prudential Center',
    location: [-71.0820, 42.3478],
    time: '11:00 AM',
    duration: '45 min',
    description: 'Skywalk views - parent-friendly',
    sentiment: 'positive',
    category: 'attraction',
  },
  {
    id: 'newbury',
    name: 'Newbury Street',
    location: [-71.0826, 42.3503],
    time: '12:00 PM',
    duration: '60 min',
    description: 'Shopping & cafes - upscale vibe',
    sentiment: 'positive',
    category: 'attraction',
  },
  {
    id: 'north-end',
    name: 'North End',
    location: [-71.0536, 42.3647],
    time: '1:30 PM',
    duration: '30 min',
    description: 'Historic Italian district',
    sentiment: 'positive',
    category: 'attraction',
  },
  {
    id: 'la-famiglia',
    name: "La Famiglia Giorgio's",
    location: [-71.0542, 42.3651],
    time: '2:00 PM',
    duration: '90 min',
    description: 'Massive portions - family staple',
    sentiment: 'positive',
    category: 'food',
  },
  {
    id: 'freedom-trail',
    name: 'Freedom Trail',
    location: [-71.0589, 42.3601],
    time: '4:00 PM',
    duration: '60 min',
    description: 'Historic walk - accessible',
    sentiment: 'positive',
    category: 'attraction',
  },
  {
    id: 'harvard',
    name: 'Harvard Square',
    location: [-71.1190, 42.3736],
    time: '5:30 PM',
    duration: '45 min',
    description: 'University atmosphere - bookstores',
    sentiment: 'positive',
    category: 'university',
  },
  {
    id: 'return',
    name: 'Return to WPI',
    location: [-71.8023, 42.2626],
    time: '7:00 PM',
    duration: '75 min',
    description: 'Worcester Line back',
    sentiment: 'neutral',
    category: 'transit',
  },
];

export default function ItineraryPanel({ onLocationClick }: ItineraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  const handleStopClick = (stop: ItineraryStop) => {
    setSelectedStop(stop.id);
    onLocationClick(stop.location, stop.name);
  };

  const filteredStops = ITINERARY_DATA.filter(stop =>
    stop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stop.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'transit': return '🚆';
      case 'food': return '🍝';
      case 'attraction': return '🏛️';
      case 'university': return '🎓';
      default: return '📍';
    }
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

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
