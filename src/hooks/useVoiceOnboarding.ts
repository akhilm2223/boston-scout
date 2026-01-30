import { useState, useCallback, useRef, useEffect } from 'react';
import voiceService, { VoiceState } from '../services/voiceService';
import { parseNaturalDate, parseSpokenNumber } from '../utils/voiceParsers';
import { parseVoiceCommand } from '../utils/voiceCommands';
import { askGemini, getRecommendations } from '../services/geminiService';
import type { TripDates, WalkingPreferences } from '../App';

interface VoiceOnboardingCallbacks {
    onTripDatesChange: (dates: TripDates) => void;
    onWalkingPreferencesChange: (prefs: WalkingPreferences) => void;
    onInterestsSelected: (interests: string[]) => void;
    onSearchQuery: (query: string) => void;
    onNavigate: (destination: 'map' | 'itinerary' | 'discovery') => void;
    onMapControl: (action: 'zoom_in' | 'zoom_out' | 'fly_to', location?: string) => void;
    onAddToItinerary: (placeName: string) => void;
    onComplete: () => void;
}

type VoiceMode = 'onboarding' | 'conversation';

interface OnboardingQuestion {
    id: string;
    text: string;
    parser: (answer: string) => any;
    onAnswer: (value: any) => void;
}

export function useVoiceOnboarding(callbacks: VoiceOnboardingCallbacks) {
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<VoiceMode>('onboarding');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isPushToTalk, setIsPushToTalk] = useState(false);
    const spaceHeldRef = useRef(false);

    const tripDatesRef = useRef<TripDates>({
        startDate: '',
        endDate: '',
        specifyTimes: false,
        arrivalTime: '00:00',
        leaveTime: '23:59',
    });

    const walkingPrefsRef = useRef<WalkingPreferences>({
        walkingTimeMinutes: 10,
        walkingDistanceMiles: 0.5,
    });

    // Push-to-talk: Space key handlers
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Only handle if in conversation mode and space is pressed
        if (e.code === 'Space' && mode === 'conversation' && isActive && !spaceHeldRef.current) {
            // Don't trigger if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            e.preventDefault();
            spaceHeldRef.current = true;
            setIsPushToTalk(true);
            console.log('[Voice] Space held - starting listening');
            voiceService.startListening().catch(err => {
                console.error('[Voice] Failed to start listening:', err);
            });
        }
    }, [mode, isActive]);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        if (e.code === 'Space' && spaceHeldRef.current) {
            e.preventDefault();
            spaceHeldRef.current = false;
            setIsPushToTalk(false);
            console.log('[Voice] Space released - stopping listening');
            // Don't stop immediately - let the final transcript come through
            setTimeout(() => {
                if (!spaceHeldRef.current) {
                    voiceService.stopListening();
                }
            }, 300);
        }
    }, []);

    // Add/remove keyboard listeners
    useEffect(() => {
        if (isActive && mode === 'conversation') {
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            console.log('[Voice] Push-to-talk enabled - hold SPACE to speak');
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isActive, mode, handleKeyDown, handleKeyUp]);

    // Parse interests from natural language
    const parseInterests = (answer: string): string[] | null => {
        const lowerInput = answer.toLowerCase();
        const interests: string[] = [];

        if (lowerInput.includes('event') || lowerInput.includes('concert') || lowerInput.includes('show') ||
            lowerInput.includes('activit') || lowerInput.includes('things to do') || lowerInput.includes('what\'s happening')) {
            interests.push('events');
        }
        if (lowerInput.includes('restaurant') || lowerInput.includes('food') || lowerInput.includes('eat') ||
            lowerInput.includes('dining') || lowerInput.includes('hungry') || lowerInput.includes('drink')) {
            interests.push('restaurants');
        }
        if (lowerInput.includes('tourist') || lowerInput.includes('sight') || lowerInput.includes('landmark') ||
            lowerInput.includes('monument') || lowerInput.includes('attraction') || lowerInput.includes('museum')) {
            interests.push('landmarks');
        }
        if (lowerInput.includes('hidden') || lowerInput.includes('secret') || lowerInput.includes('local') ||
            lowerInput.includes('off the beaten') || lowerInput.includes('unknown')) {
            interests.push('hidden');
        }
        if (lowerInput.includes('everything') || lowerInput.includes('all') || lowerInput.includes('anything') || lowerInput.includes('explore')) {
            interests.push('events', 'restaurants', 'landmarks');
        }

        return interests.length > 0 ? interests : null;
    };

    // Define onboarding questions
    const questions: OnboardingQuestion[] = [
        {
            id: 'start-date',
            text: "When are you arriving in New York City?",
            parser: (answer: string) => parseNaturalDate(answer),
            onAnswer: (date: Date | null) => {
                if (date) {
                    const formattedDate = date.toISOString().split('T')[0];
                    console.log('[Voice] ✅ Parsed start date:', formattedDate);
                    tripDatesRef.current.startDate = formattedDate;
                    callbacks.onTripDatesChange(tripDatesRef.current);
                }
            }
        },
        {
            id: 'end-date',
            text: "When will you be leaving?",
            parser: (answer: string) => parseNaturalDate(answer),
            onAnswer: (date: Date | null) => {
                if (date) {
                    const formattedDate = date.toISOString().split('T')[0];
                    console.log('[Voice] ✅ Parsed end date:', formattedDate);
                    tripDatesRef.current.endDate = formattedDate;
                    callbacks.onTripDatesChange(tripDatesRef.current);
                }
            }
        },
        {
            id: 'walking-distance',
            text: "How many miles would you like to walk per day?",
            parser: (answer: string) => parseSpokenNumber(answer),
            onAnswer: (miles: number | null) => {
                if (miles !== null && miles > 0) {
                    console.log('[Voice] ✅ Parsed walking distance:', miles, 'miles');
                    walkingPrefsRef.current.walkingDistanceMiles = miles;
                    walkingPrefsRef.current.walkingTimeMinutes = Math.round((miles / 3) * 60);
                    callbacks.onWalkingPreferencesChange(walkingPrefsRef.current);
                }
            }
        },
        {
            id: 'interests',
            text: "What are you looking to do in the city?",
            parser: (answer: string) => parseInterests(answer),
            onAnswer: (interests: string[] | null) => {
                if (interests && interests.length > 0) {
                    console.log('[Voice] ✅ Detected interests:', interests);
                    callbacks.onInterestsSelected(interests);
                }
            }
        }
    ];

    // Handle conversational input (after onboarding)
    const handleConversationalInput = useCallback(async (transcript: string) => {
        console.log('[Voice] Conversational input:', transcript);
        const command = parseVoiceCommand(transcript);

        console.log('[Voice] Parsed command:', command);

        try {
            switch (command.type) {
                case 'exit':
                    await voiceService.speak("Goodbye! Have a great time in New York!");
                    setTimeout(() => {
                        setIsActive(false);
                        callbacks.onComplete();
                    }, 2000);
                    break;

                case 'scroll':
                    await voiceService.speak(`Scrolling ${command.action}`);
                    window.scrollBy({ top: command.action === 'down' ? 400 : -400, behavior: 'smooth' });
                    voiceService.stopListening();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await voiceService.startListening();
                    break;

                case 'navigate':
                    const destination = command.action as 'map' | 'itinerary' | 'discovery';
                    const destNames: Record<string, string> = {
                        'map': 'the map',
                        'itinerary': 'your itinerary',
                        'discovery': 'the discovery panel'
                    };
                    await voiceService.speak(`Opening ${destNames[destination] || destination}`);
                    callbacks.onNavigate(destination);
                    voiceService.stopListening();
                    await new Promise(resolve => setTimeout(resolve, 800));
                    await voiceService.startListening();
                    break;

                case 'toggle_layer':
                    const layerNames: Record<string, string> = {
                        'events': 'events and activities',
                        'places': 'restaurants and places',
                        'landmarks': 'landmarks and attractions',
                        'hidden': 'hidden gems'
                    };
                    await voiceService.speak(`Showing ${layerNames[command.layer!] || command.layer}`);
                    callbacks.onInterestsSelected([command.layer!]);
                    voiceService.stopListening();
                    await new Promise(resolve => setTimeout(resolve, 800));
                    await voiceService.startListening();
                    break;

                case 'search_query':
                    // Don't speak twice - just trigger search and get recommendations
                    callbacks.onSearchQuery(command.query!);
                    setVoiceState('processing');
                    const recs = await getRecommendations(command.query!);
                    // Speak only the recommendations
                    await voiceService.speak(recs);
                    break;

                case 'add_to_itinerary':
                    if (command.placeName) {
                        await voiceService.speak(`Adding ${command.placeName} to your itinerary`);
                        callbacks.onAddToItinerary(command.placeName);
                    }
                    break;

                case 'map_control':
                    if (command.action === 'zoom_in') {
                        await voiceService.speak('Zooming in');
                        callbacks.onMapControl('zoom_in');
                    } else if (command.action === 'zoom_out') {
                        await voiceService.speak('Zooming out');
                        callbacks.onMapControl('zoom_out');
                    } else if (command.action === 'fly_to' && command.location) {
                        await voiceService.speak(`Flying to ${command.location}`);
                        callbacks.onMapControl('fly_to', command.location);
                    }
                    break;

                case 'compound':
                    // Handle compound commands - execute each sub-command
                    if (command.subCommands && command.subCommands.length > 0) {
                        await voiceService.speak(`Got it, I'll do ${command.subCommands.length} things`);
                        for (const subCmd of command.subCommands) {
                            console.log('[Voice] Executing sub-command:', subCmd.type);
                            if (subCmd.type === 'search_query' && subCmd.query) {
                                callbacks.onSearchQuery(subCmd.query);
                            } else if (subCmd.type === 'add_to_itinerary' && subCmd.placeName) {
                                callbacks.onAddToItinerary(subCmd.placeName);
                            } else if (subCmd.type === 'toggle_layer' && subCmd.layer) {
                                callbacks.onInterestsSelected([subCmd.layer]);
                            } else if (subCmd.type === 'map_control') {
                                callbacks.onMapControl(subCmd.action as 'zoom_in' | 'zoom_out' | 'fly_to', subCmd.location);
                            }
                            // Small delay between commands
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                    break;

                case 'gemini_question':
                    setVoiceState('processing');
                    const answer = await askGemini(transcript);
                    await voiceService.speak(answer);
                    break;
            }
        } catch (error) {
            console.error('[Voice] Error in conversational handler:', error);
            await voiceService.speak("Sorry, I encountered an error. Please try again.");
        }
        // In push-to-talk mode, don't auto-restart - user will press space again
        setVoiceState('idle');
    }, [callbacks]);

    // Handle answer with proper dependencies
    const handleAnswer = useCallback(async (answer: string) => {
        // If in conversation mode, handle differently
        if (mode === 'conversation') {
            await handleConversationalInput(answer);
            return;
        }

        // Onboarding mode
        console.log('[Voice] ========================================');
        console.log('[Voice] handleAnswer CALLED with:', answer);
        const question = questions[currentQuestionIndex];
        if (!question) {
            console.error('[Voice] NO QUESTION FOUND at index:', currentQuestionIndex);
            return;
        }

        voiceService.stopListening();
        setCurrentTranscript('');

        const parsedValue = question.parser(answer);
        console.log('[Voice] Parser returned:', parsedValue);

        if (parsedValue !== null && parsedValue !== undefined && (Array.isArray(parsedValue) ? parsedValue.length > 0 : true)) {
            console.log('[Voice] ✅ Valid answer!');
            question.onAnswer(parsedValue);

            // Move to next question or switch to conversation mode
            if (currentQuestionIndex < questions.length - 1) {
                const nextIndex = currentQuestionIndex + 1;
                console.log('[Voice] Moving to next question:', nextIndex);
                setTimeout(() => setCurrentQuestionIndex(nextIndex), 1500);
            } else {
                // Onboarding complete - switch to conversation mode
                console.log('[Voice] 🎉 Onboarding complete! Switching to conversation mode');
                await voiceService.speak("Perfect! I'm ready to help. Ask me anything about NYC, or say commands like 'show events' or 'scroll down'.");
                setTimeout(() => {
                    setMode('conversation');
                    voiceService.startListening();
                }, 3000);
            }
        } else {
            console.log('[Voice] ❌ Invalid answer');
            await voiceService.speak("I didn't quite catch that. Let me ask again.");
            setTimeout(async () => {
                await voiceService.speak(question.text);
                await new Promise(resolve => setTimeout(resolve, 500));
                await voiceService.startListening();
            }, 1000);
        }
        console.log('[Voice] ========================================');
    }, [currentQuestionIndex, mode, handleConversationalInput]);

    // Initialize voice service callbacks
    useEffect(() => {
        if (!isActive) return;

        voiceService.setCallbacks({
            onStateChange: (state) => setVoiceState(state),
            onTranscript: (transcript, isFinal) => {
                setCurrentTranscript(transcript);
                if (isFinal && transcript.trim()) {
                    handleAnswer(transcript.trim());
                }
            },
            onError: (err) => {
                console.error('[Voice] Error:', err);
                setError(err);
                setTimeout(() => setError(null), 5000);
            },
            onAudioLevel: () => { }
        });
    }, [isActive, handleAnswer]);

    const askCurrentQuestion = useCallback(async () => {
        if (mode !== 'onboarding') return;

        const question = questions[currentQuestionIndex];
        if (!question) return;

        try {
            await voiceService.speak(question.text);
            await new Promise(resolve => setTimeout(resolve, 500));
            await voiceService.startListening();
        } catch (error) {
            console.error('[Voice] Error in askCurrentQuestion:', error);
            setError('Voice error. Please try again.');
        }
    }, [currentQuestionIndex, mode]);

    // Trigger question when index changes (onboarding mode only)
    useEffect(() => {
        if (isActive && mode === 'onboarding' && currentQuestionIndex >= 0) {
            askCurrentQuestion();
        }
    }, [currentQuestionIndex, isActive, mode, askCurrentQuestion]);

    const start = useCallback(async () => {
        console.log('[Voice] start() called');
        setIsActive(true);
        setMode('onboarding');
        setCurrentQuestionIndex(0);
        setError(null);
    }, []);

    const stop = useCallback(() => {
        console.log('[Voice] stop() called');
        setIsActive(false);
        setMode('onboarding');
        voiceService.cleanup();
    }, []);

    // Manual listening controls for push-to-talk
    const startListening = useCallback(async () => {
        try {
            await voiceService.startListening();
        } catch (err) {
            console.error('[Voice] Failed to start:', err);
        }
    }, []);

    const stopListening = useCallback(() => {
        voiceService.stopListening();
    }, []);

    // Skip onboarding and go directly to conversation mode
    const skipToConversation = useCallback(() => {
        console.log('[Voice] Skipping to conversation mode');
        setIsActive(true);
        setMode('conversation');
        setCurrentQuestionIndex(-1);
    }, []);

    return {
        isActive,
        mode,
        start,
        stop,
        startListening,
        stopListening,
        skipToConversation,
        isPushToTalk,
        currentQuestion: mode === 'onboarding' ? questions[currentQuestionIndex] : null,
        currentTranscript,
        voiceState,
        error,
        progress: mode === 'onboarding' ? {
            current: currentQuestionIndex + 1,
            total: questions.length
        } : null
    };
}
