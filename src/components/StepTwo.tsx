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
                <h2 className="text-2xl font-bold text-(--text-primary) transition-colors duration-300">How far would you like to walk from T stations?</h2>
                <p className="text-(--text-secondary) mt-2 transition-colors duration-300">Set your preferred maximum walking distance from transit stops</p>
            </div>

            {/* Walking Time Slider */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-(--text-secondary) transition-colors duration-300">
                        Walking Time
                    </label>
                    <span className="text-2xl font-bold text-(--accent) transition-colors duration-300">
                        {walkingTimeMinutes} min
                    </span>
                </div>
                
                <input
                    type="range"
                    min="1"
                    max="30"
                    value={walkingTimeMinutes}
                    onChange={(e) => setWalkingTimeMinutes(Number(e.target.value))}
                    className="w-full h-3 bg-(--bg-tertiary) rounded-lg appearance-none cursor-pointer accent-(--accent)"
                />
                
                <div className="flex justify-between text-xs text-(--text-muted) transition-colors duration-300">
                    <span>1 min</span>
                    <span>15 min</span>
                    <span>30 min</span>
                </div>
            </div>

            {/* Distance Summary */}
            <div className="bg-(--accent-muted) rounded-lg p-6 text-center transition-colors duration-300">
                <p className="text-(--text-secondary) text-sm mb-2 transition-colors duration-300">This is approximately</p>
                <p className="text-3xl font-bold text-(--accent) transition-colors duration-300">
                    {formatDistance(calculateDistance(walkingTimeMinutes))}
                </p>
                <p className="text-(--text-muted) text-sm mt-2 transition-colors duration-300">
                    Based on average walking speed of {WALKING_SPEED_MPH} mph
                </p>
            </div>

            {/* Quick Select Buttons */}
            <div className="border-t border-(--border-primary) pt-6 transition-colors duration-300">
                <p className="text-sm font-medium text-(--text-secondary) mb-3 transition-colors duration-300">Quick select:</p>
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
                                    ? 'bg-(--accent) text-(--text-inverse)'
                                    : 'bg-(--bg-secondary) hover:bg-(--bg-hover) text-(--text-primary)'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-(--bg-secondary) rounded-lg p-4 border border-(--border-primary) transition-colors duration-300">
                <div className="flex items-start space-x-3">
                    <span className="text-xl">🚶</span>
                    <div>
                        <p className="text-sm text-(--text-primary) font-medium transition-colors duration-300">Why does this matter?</p>
                        <p className="text-sm text-(--text-muted) mt-1 transition-colors duration-300">
                            We'll use this preference to find events, restaurants, and attractions 
                            that are within your comfortable walking distance from MBTA stations.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}