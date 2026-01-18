import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Initialize ElevenLabs client with API key from environment
const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

if (!apiKey) {
    console.warn('ElevenLabs API key not found. Voice features will be disabled.');
}

const client = apiKey ? new ElevenLabsClient({ apiKey }) : null;

// Default voice settings - can be customized
const VOICE_SETTINGS = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true
};

// Default voice ID - using Rachel (a clear, friendly female voice)
// Voice ID from ElevenLabs voice library
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

export interface TextToSpeechOptions {
    voice?: string;
    stability?: number;
    similarity_boost?: number;
}

/**
 * Convert text to speech using ElevenLabs API
 * Returns an audio URL that can be played
 */
export async function textToSpeech(
    text: string,
    options: TextToSpeechOptions = {}
): Promise<string | null> {
    if (!client) {
        console.error('ElevenLabs client not initialized. Check your API key.');
        return null;
    }

    if (!text || text.trim().length === 0) {
        console.warn('Empty text provided for text-to-speech');
        return null;
    }

    try {
        const voiceId = options.voice || DEFAULT_VOICE_ID;

        // Generate audio using streaming API
        const audioStream = await client.textToSpeech.convert(voiceId, {
            text,
            model_id: 'eleven_turbo_v2_5', // Fast, low-latency model
            voice_settings: {
                stability: options.stability ?? VOICE_SETTINGS.stability,
                similarity_boost: options.similarity_boost ?? VOICE_SETTINGS.similarity_boost,
                style: VOICE_SETTINGS.style,
                use_speaker_boost: VOICE_SETTINGS.use_speaker_boost
            }
        });

        // Convert stream to blob
        const chunks: Uint8Array[] = [];
        for await (const chunk of audioStream) {
            chunks.push(chunk);
        }

        // Combine chunks into a single blob
        const audioBlob = new Blob(chunks as any[], { type: 'audio/mpeg' });

        // Create URL for the audio blob
        const audioUrl = URL.createObjectURL(audioBlob);

        return audioUrl;
    } catch (error) {
        console.error('Error generating speech:', error);
        if (error instanceof Error) {
            // Provide more specific error messages
            if (error.message.includes('unauthorized') || error.message.includes('401')) {
                console.error('Invalid ElevenLabs API key. Please check your credentials.');
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                console.error('ElevenLabs quota exceeded. You may need to upgrade your plan.');
            }
        }
        return null;
    }
}

/**
 * Play audio from a URL
 */
export async function playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            // Clean up the blob URL
            URL.revokeObjectURL(audioUrl);
            resolve();
        };

        audio.onerror = (error) => {
            console.error('Error playing audio:', error);
            URL.revokeObjectURL(audioUrl);
            reject(error);
        };

        audio.play().catch(error => {
            console.error('Failed to play audio:', error);
            URL.revokeObjectURL(audioUrl);
            reject(error);
        });
    });
}

/**
 * Generate and play speech in one call
 */
export async function speak(text: string, options: TextToSpeechOptions = {}): Promise<void> {
    const audioUrl = await textToSpeech(text, options);
    if (audioUrl) {
        await playAudio(audioUrl);
    } else {
        throw new Error('Failed to generate speech');
    }
}

/**
 * Check if ElevenLabs is properly configured
 */
export function isElevenLabsConfigured(): boolean {
    return client !== null;
}
