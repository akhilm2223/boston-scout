import React, { useState, useEffect, useCallback, useRef } from 'react';
import voiceService, { VoiceState } from '../services/voiceService';
import VoiceVisualizer from './VoiceVisualizer';
import './VoiceMode.css';

// Simple icon components
const MicIcon = ({ className = '' }) => (
    <svg className={className} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
);

const XIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const LoaderIcon = ({ className = '' }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface VoiceModeProps {
    onExit: () => void;
    onLocationQuery?: (query: string) => void;
}

// Import Gemini API service
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

const VoiceMode: React.FC<VoiceModeProps> = ({ onExit, onLocationQuery }) => {
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [audioLevel, setAudioLevel] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isHoldingToTalk, setIsHoldingToTalk] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatRef = useRef<any>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initialize voice service callbacks
    useEffect(() => {
        voiceService.setCallbacks({
            onStateChange: (state) => {
                setVoiceState(state);
            },
            onTranscript: (transcript, isFinal) => {
                setCurrentTranscript(transcript);

                if (isFinal && transcript.trim()) {
                    handleUserMessage(transcript.trim());
                    setCurrentTranscript('');
                }
            },
            onError: (err) => {
                setError(err);
                setTimeout(() => setError(null), 5000);
            },
            onAudioLevel: (level) => {
                setAudioLevel(level);
            }
        });

        // Initialize Gemini chat session
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        chatRef.current = model.startChat({
            history: [],
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        // Show welcome message immediately
        const welcomeMessage: Message = {
            role: 'assistant',
            content: "Welcome! Press and hold the microphone button or spacebar to start talking. I'm your Boston guide ready to help!",
            timestamp: new Date()
        };
        setMessages([welcomeMessage]);

        return () => {
            voiceService.cleanup();
        };
    }, []);

    const handleUserMessage = useCallback(async (text: string) => {
        // Add user message to history
        const userMessage: Message = {
            role: 'user',
            content: text,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);

        // Stop listening while processing
        voiceService.stopListening();
        voiceService.setProcessing();

        try {
            // Send to Gemini
            const result = await chatRef.current.sendMessage(
                `You are a helpful Boston city guide. Keep responses concise (2-3 sentences max) and conversational. 
         User asked: ${text}`
            );
            const response = await result.response;
            const responseText = response.text();

            // Add assistant message
            const assistantMessage: Message = {
                role: 'assistant',
                content: responseText,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);

            // Check if user is asking about a location
            if (onLocationQuery) {
                const locationKeywords = ['show', 'where', 'find', 'locate', 'navigate', 'take me'];
                if (locationKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
                    onLocationQuery(text);
                }
            }

            // Speak the response
            await voiceService.speak(responseText);

        } catch (error) {
            console.error('Error processing message:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: "Sorry, I had trouble processing that. Could you try again?",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            await voiceService.speak(errorMessage.content);
        }
    }, [onLocationQuery]);

    const handleMicButtonPress = useCallback(() => {
        if (!voiceService.isSupportedBrowser()) {
            setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        setIsHoldingToTalk(true);
        voiceService.startListening().catch(err => {
            console.error('Failed to start listening:', err);
            setIsHoldingToTalk(false);
        });
    }, []);

    const handleMicButtonRelease = useCallback(() => {
        setIsHoldingToTalk(false);
        voiceService.stopListening();
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === ' ' && !isHoldingToTalk) {
                e.preventDefault();
                handleMicButtonPress();
            } else if (e.key === 'Escape') {
                onExit();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === ' ' && isHoldingToTalk) {
                e.preventDefault();
                handleMicButtonRelease();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isHoldingToTalk, handleMicButtonPress, handleMicButtonRelease, onExit]);

    return (
        <div className="voice-mode">
            {/* Background */}
            <div className="voice-mode-background" />

            {/* Header */}
            <div className="voice-mode-header">
                <div className="voice-mode-title">
                    <div className="voice-mode-logo" />
                    <h1>Voice Navigation</h1>
                </div>
                <button className="voice-mode-exit" onClick={onExit}>
                    <XIcon />
                </button>
            </div>

            {/* Main Content */}
            <div className="voice-mode-content">
                {/* Conversation History */}
                <div className="voice-mode-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`voice-message ${msg.role}`}>
                            <div className="voice-message-content">{msg.content}</div>
                            <div className="voice-message-time">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    ))}

                    {currentTranscript && (
                        <div className="voice-message user interim">
                            <div className="voice-message-content">{currentTranscript}</div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Voice Visualizer */}
                <div className="voice-visualizer-container">
                    <VoiceVisualizer
                        audioLevel={audioLevel}
                        isActive={voiceState === 'listening'}
                    />
                </div>

                {/* Status Display */}
                <div className="voice-status">
                    {voiceState === 'listening' && (
                        <p className="status-text listening">Listening...</p>
                    )}
                    {voiceState === 'processing' && (
                        <p className="status-text processing">
                            <LoaderIcon className="spinner" /> Processing...
                        </p>
                    )}
                    {voiceState === 'speaking' && (
                        <p className="status-text speaking">Speaking...</p>
                    )}
                    {voiceState === 'idle' && (
                        <p className="status-text idle">Press and hold to speak</p>
                    )}
                </div>

                {/* Error Display */}
                {error && (
                    <div className="voice-error">
                        {error}
                    </div>
                )}

                {/* Microphone Button */}
                <div className="voice-controls">
                    <button
                        className={`voice-mic-button ${voiceState}`}
                        onMouseDown={handleMicButtonPress}
                        onMouseUp={handleMicButtonRelease}
                        onMouseLeave={handleMicButtonRelease}
                        onTouchStart={handleMicButtonPress}
                        onTouchEnd={handleMicButtonRelease}
                    >
                        <div className="mic-button-inner">
                            {voiceState === 'processing' ? (
                                <LoaderIcon className="spinner" />
                            ) : (
                                <MicIcon className="mic-icon" />
                            )}
                        </div>
                    </button>
                    <p className="voice-hint">Hold spacebar or button to talk</p>
                </div>
            </div>
        </div>
    );
};

export default VoiceMode;
