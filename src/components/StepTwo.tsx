import { useState, useEffect } from "react";
import { WalkingPreferences } from "../App";

interface StepTwoProps {
    data: WalkingPreferences;
    onChange: (data: WalkingPreferences) => void;
}

const WALKING_SPEED_MPH = 3;

export default function StepTwo({ data, onChange }: StepTwoProps) {
    const [walkingTimeMinutes, setWalkingTimeMinutes] = useState<number>(data.walkingTimeMinutes || 10);

    // Calculate distance based on time and walking speed
    const calculateDistance = (minutes: number): number => {
        return (minutes / 60) * WALKING_SPEED_MPH;
    };

    // Sync with parent
    useEffect(() => {
        onChange({
            walkingTimeMinutes,
            walkingDistanceMiles: calculateDistance(walkingTimeMinutes),
        });
    }, [walkingTimeMinutes, onChange]);

    // Format distance for display
    const formatDistance = (miles: number): string => {
        if (miles < 0.1) {
            return `${Math.round(miles * 5280)} ft`;
        }
        return `${miles.toFixed(2)} mi`;
    };

    return (
        <div className="w-full p-6 space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800">How far would you like to walk from T stations?</h2>
                <p className="text-gray-500 mt-2">Set your preferred maximum walking distance from transit stops</p>
            </div>

            {/* Walking Time Slider */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-700">
                        Walking Time
                    </label>
                    <span className="text-2xl font-bold text-blue-600">
                        {walkingTimeMinutes} min
                    </span>
                </div>
                
                <input
                    type="range"
                    min="1"
                    max="30"
                    value={walkingTimeMinutes}
                    onChange={(e) => setWalkingTimeMinutes(Number(e.target.value))}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                
                <div className="flex justify-between text-xs text-gray-500">
                    <span>1 min</span>
                    <span>15 min</span>
                    <span>30 min</span>
                </div>
            </div>

            {/* Distance Summary */}
            <div className="bg-blue-50 rounded-lg p-6 text-center">
                <p className="text-gray-600 text-sm mb-2">This is approximately</p>
                <p className="text-3xl font-bold text-blue-800">
                    {formatDistance(calculateDistance(walkingTimeMinutes))}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                    Based on average walking speed of {WALKING_SPEED_MPH} mph
                </p>
            </div>

            {/* Quick Select Buttons */}
            <div className="border-t pt-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Quick select:</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        { label: '5 min (quick)', value: 5 },
                        { label: '10 min (moderate)', value: 10 },
                        { label: '15 min (comfortable)', value: 15 },
                        { label: '20 min (extended)', value: 20 },
                    ].map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setWalkingTimeMinutes(option.value)}
                            className={`px-4 py-2 rounded-full text-sm transition-colors ${
                                walkingTimeMinutes === option.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start space-x-3">
                    <span className="text-xl">🚶</span>
                    <div>
                        <p className="text-sm text-gray-700 font-medium">Why does this matter?</p>
                        <p className="text-sm text-gray-500 mt-1">
                            We'll use this preference to find events, restaurants, and attractions 
                            that are within your comfortable walking distance from MBTA stations.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}