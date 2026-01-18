import { textToSpeech } from './elevenlabsService';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceServiceCallbacks {
    onStateChange?: (state: VoiceState) => void;
    onTranscript?: (transcript: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    onAudioLevel?: (level: number) => void;
}

// Check if browser supports Web Speech API
const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

class VoiceService {
    private recognition: any = null;
    private state: VoiceState = 'idle';
    private callbacks: VoiceServiceCallbacks = {};
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private microphone: MediaStreamAudioSourceNode | null = null;
    private animationFrameId: number | null = null;
    private currentAudio: HTMLAudioElement | null = null;
    private isRecognitionActive: boolean = false;

    constructor() {
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event: any) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcript = result[0].transcript;
                    const isFinal = result.isFinal;

                    if (this.callbacks.onTranscript) {
                        this.callbacks.onTranscript(transcript, isFinal);
                    }
                }
            };

            this.recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);

                let errorMessage = 'Speech recognition error';

                // Provide helpful error messages
                switch (event.error) {
                    case 'network':
                        errorMessage = 'Network error. Please check your internet connection and try again.';
                        break;
                    case 'not-allowed':
                    case 'permission-denied':
                        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
                        break;
                    case 'no-speech':
                        errorMessage = 'No speech detected. Please try speaking again.';
                        break;
                    case 'audio-capture':
                        errorMessage = 'Microphone not found. Please check your microphone connection.';
                        break;
                    case 'aborted':
                        // Don't show error for user-initiated stops
                        return;
                    default:
                        errorMessage = `Speech recognition error: ${event.error}`;
                }

                if (this.callbacks.onError) {
                    this.callbacks.onError(errorMessage);
                }
                this.setState('idle');
            };

            this.recognition.onend = () => {
                this.isRecognitionActive = false;
                // If we're still supposed to be listening, restart
                if (this.state === 'listening') {
                    try {
                        this.isRecognitionActive = true;
                        this.recognition.start();
                    } catch (error) {
                        console.error('Failed to restart recognition:', error);
                        this.isRecognitionActive = false;
                        this.setState('idle');
                    }
                }
            };
        }
    }

    private setState(newState: VoiceState) {
        this.state = newState;
        if (this.callbacks.onStateChange) {
            this.callbacks.onStateChange(newState);
        }
    }

    /**
     * Register callbacks for voice events
     */
    setCallbacks(callbacks: VoiceServiceCallbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Start listening for speech input
     */
    async startListening(): Promise<void> {
        if (!SpeechRecognition) {
            const error = 'Speech recognition is not supported in this browser. Please use Chrome or Edge.';
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            throw new Error(error);
        }

        // Check both state AND if recognition is actually running
        if (this.state === 'listening' || this.isRecognitionActive) {
            console.warn('Already listening, skipping start');
            return;
        }

        try {
            // Initialize audio visualization
            await this.initializeAudioVisualization();

            this.setState('listening');
            this.isRecognitionActive = true;
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start listening:', error);
            this.isRecognitionActive = false;
            if (this.callbacks.onError) {
                this.callbacks.onError('Failed to start listening. Please check microphone permissions.');
            }
            this.setState('idle');
            throw error;
        }
    }

    /**
     * Stop listening for speech input
     */
    stopListening() {
        if (this.recognition && (this.state === 'listening' || this.isRecognitionActive)) {
            this.isRecognitionActive = false;
            this.recognition.stop();
            this.stopAudioVisualization();
            this.setState('idle');
        }
    }

    /**
     * Initialize audio visualization for microphone input
     */
    private async initializeAudioVisualization() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            this.startAudioLevelMonitoring();
        } catch (error) {
            console.error('Failed to initialize audio visualization:', error);
        }
    }

    /**
     * Monitor audio levels for visualization
     */
    private startAudioLevelMonitoring() {
        if (!this.analyser) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const checkLevel = () => {
            if (!this.analyser || this.state !== 'listening') return;

            this.analyser.getByteFrequencyData(dataArray);

            // Calculate average audio level (0-1)
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const normalizedLevel = Math.min(average / 128, 1);

            if (this.callbacks.onAudioLevel) {
                this.callbacks.onAudioLevel(normalizedLevel);
            }

            this.animationFrameId = requestAnimationFrame(checkLevel);
        };

        checkLevel();
    }

    /**
     * Stop audio visualization
     */
    private stopAudioVisualization() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.analyser = null;
    }

    /**
     * Speak text using ElevenLabs TTS
     */
    async speak(text: string): Promise<void> {
        if (!text || text.trim().length === 0) return;

        try {
            this.setState('speaking');

            // Stop any currently playing audio
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }

            const audioUrl = await textToSpeech(text);

            if (!audioUrl) {
                throw new Error('Failed to generate speech');
            }

            // Play the audio
            await new Promise<void>((resolve, reject) => {
                this.currentAudio = new Audio(audioUrl);

                this.currentAudio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    this.currentAudio = null;
                    this.setState('idle');
                    resolve();
                };

                this.currentAudio.onerror = (error) => {
                    console.error('Error playing audio:', error);
                    URL.revokeObjectURL(audioUrl);
                    this.currentAudio = null;
                    this.setState('idle');
                    reject(error);
                };

                this.currentAudio.play().catch(error => {
                    console.error('Failed to play audio:', error);
                    URL.revokeObjectURL(audioUrl);
                    this.currentAudio = null;
                    this.setState('idle');
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Error in speak:', error);

            // Check if it's an autoplay error
            if (error instanceof Error && error.message.includes('play')) {
                console.warn('Audio playback blocked by browser. User interaction required.');
                // Don't show error to user for autoplay blocks - it's expected
            } else if (this.callbacks.onError) {
                this.callbacks.onError('Failed to generate or play speech');
            }

            this.setState('idle');
            throw error;
        }
    }

    /**
     * Stop speaking
     */
    stopSpeaking() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        if (this.state === 'speaking') {
            this.setState('idle');
        }
    }

    /**
     * Get current voice state
     */
    getState(): VoiceState {
        return this.state;
    }

    /**
     * Set state to processing (e.g., waiting for AI response)
     */
    setProcessing() {
        this.setState('processing');
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.stopListening();
        this.stopSpeaking();
        this.stopAudioVisualization();
    }

    /**
     * Check if speech recognition is supported
     */
    static isSupported(): boolean {
        return !!SpeechRecognition;
    }

    /**
     * Instance method to check if speech recognition is supported
     */
    isSupportedBrowser(): boolean {
        return VoiceService.isSupported();
    }
}

// Export singleton instance
export const voiceService = new VoiceService();
export { VoiceService };
export default voiceService;
