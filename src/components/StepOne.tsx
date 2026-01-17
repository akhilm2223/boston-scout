import { useState, useEffect } from "react";

interface StepOneProps {
    data: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
}

export default function StepOne({ data, onChange }: StepOneProps) {
    const [startDate, setStartDate] = useState<string>(data.startDate || '');
    const [endDate, setEndDate] = useState<string>(data.endDate || '');
    const [specifyTimes, setSpecifyTimes] = useState<boolean>(data.specifyTimes || false);
    const [arrivalTime, setArrivalTime] = useState<string>(data.arrivalTime || '00:00');
    const [leaveTime, setLeaveTime] = useState<string>(data.leaveTime || '23:59');

    // Sync with parent form data
    useEffect(() => {
        onChange({
            ...data,
            startDate,
            endDate,
            specifyTimes,
            arrivalTime: specifyTimes ? arrivalTime : '00:00',
            leaveTime: specifyTimes ? leaveTime : '23:59',
        });
    }, [startDate, endDate, specifyTimes, arrivalTime, leaveTime]);

    // Parse date string as local date (not UTC)
    const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    // Format date for display
    const formatDateDisplay = () => {
        if (!startDate) return 'Select dates';
        if (!endDate || startDate === endDate) {
            return parseLocalDate(startDate).toLocaleDateString('en-US', { 
                weekday: 'short', month: 'short', day: 'numeric' 
            });
        }
        const start = parseLocalDate(startDate).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric' 
        });
        const end = parseLocalDate(endDate).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric' 
        });
        return `${start} - ${end}`;
    };

    // Calculate number of days
    const getDayCount = () => {
        if (!startDate || !endDate) return 0;
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
        return diffDays;
    };

    return (
        <div className="w-full p-6 space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-(--text-primary) transition-colors duration-300">When are you visiting Boston?</h2>
                <p className="text-(--text-secondary) mt-2 transition-colors duration-300">Select your travel dates to help us plan your itinerary</p>
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-(--text-secondary) transition-colors duration-300">
                        Start Date
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e.target.value);
                            // If end date is before start date, update it
                            if (endDate && e.target.value > endDate) {
                                setEndDate(e.target.value);
                            }
                        }}
                        className="w-full px-4 py-3 border border-(--border-primary) bg-(--bg-input) text-(--text-primary) rounded-lg focus:ring-2 focus:ring-(--accent) focus:border-transparent transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-(--text-secondary) transition-colors duration-300">
                        End Date
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-3 border border-(--border-primary) bg-(--bg-input) text-(--text-primary) rounded-lg focus:ring-2 focus:ring-(--accent) focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* Date Summary */}
            {startDate && (
                <div className="bg-(--accent-muted) rounded-lg p-4 text-center transition-colors duration-300">
                    <p className="text-(--text-primary) font-medium transition-colors duration-300">{formatDateDisplay()}</p>
                    <p className="text-(--accent) text-sm mt-1 transition-colors duration-300">
                        {getDayCount()} {getDayCount() === 1 ? 'day' : 'days'} (inclusive)
                    </p>
                </div>
            )}

            {/* Time Specification Toggle */}
            <div className="border-t border-(--border-primary) pt-6 transition-colors duration-300">
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={specifyTimes}
                        onChange={(e) => setSpecifyTimes(e.target.checked)}
                        className="w-5 h-5 text-(--accent) border-(--border-primary) rounded focus:ring-(--accent)"
                    />
                    <span className="text-(--text-primary) transition-colors duration-300">Specify arrival and departure times</span>
                </label>
                <p className="text-(--text-muted) text-sm mt-1 ml-8 transition-colors duration-300">
                    {specifyTimes 
                        ? "Set specific times for your arrival and departure"
                        : "We'll assume full days (midnight to midnight)"
                    }
                </p>
            </div>

            {/* Time Selection (conditional) */}
            {specifyTimes && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-(--text-secondary) transition-colors duration-300">
                            Arrival Time {startDate && `on ${parseLocalDate(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </label>
                        <input
                            type="time"
                            value={arrivalTime}
                            onChange={(e) => setArrivalTime(e.target.value)}
                            className="w-full px-4 py-3 border border-(--border-primary) bg-(--bg-input) text-(--text-primary) rounded-lg focus:ring-2 focus:ring-(--accent) focus:border-transparent transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-(--text-secondary) transition-colors duration-300">
                            Departure Time {endDate && `on ${parseLocalDate(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </label>
                        <input
                            type="time"
                            value={leaveTime}
                            onChange={(e) => setLeaveTime(e.target.value)}
                            className="w-full px-4 py-3 border border-(--border-primary) bg-(--bg-input) text-(--text-primary) rounded-lg focus:ring-2 focus:ring-(--accent) focus:border-transparent transition-all"
                        />
                    </div>
                </div>
            )}

            {/* Quick Select Buttons */}
            <div className="border-t border-(--border-primary) pt-6 transition-colors duration-300">
                <p className="text-sm font-medium text-(--text-secondary) mb-3 transition-colors duration-300">Quick select:</p>
                <div className="flex flex-wrap gap-2">
                    {['Today', 'Tomorrow', 'This Weekend', 'Next Week'].map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                let start = new Date();
                                let end = new Date();
                                
                                switch (option) {
                                    case 'Today':
                                        // start and end are today
                                        break;
                                    case 'Tomorrow':
                                        start.setDate(today.getDate() + 1);
                                        end.setDate(today.getDate() + 1);
                                        break;
                                    case 'This Weekend':
                                        const dayOfWeek = today.getDay();
                                        const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
                                        start.setDate(today.getDate() + daysUntilSaturday);
                                        end.setDate(today.getDate() + daysUntilSaturday + 1);
                                        break;
                                    case 'Next Week':
                                        const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
                                        start.setDate(today.getDate() + daysUntilMonday);
                                        end.setDate(today.getDate() + daysUntilMonday + 6);
                                        break;
                                }
                                
                                // Format as YYYY-MM-DD in local timezone (not UTC)
                                const formatDate = (d: Date) => {
                                    const year = d.getFullYear();
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const day = String(d.getDate()).padStart(2, '0');
                                    return `${year}-${month}-${day}`;
                                };
                                
                                setStartDate(formatDate(start));
                                setEndDate(formatDate(end));
                            }}
                            className="px-4 py-2 bg-(--bg-secondary) hover:bg-(--bg-hover) text-(--text-primary) rounded-full text-sm transition-colors"
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}