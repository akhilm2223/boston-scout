import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.warn('VITE_GEMINI_API_KEY is not set. Gemini features will be disabled.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }) : null;

/**
 * Ask Gemini a question about Boston
 * Returns a concise answer suitable for text-to-speech
 */
export async function askGemini(question: string): Promise<string> {
    if (!model) {
        return "I'm sorry, the AI assistant is not configured. Please check your API key.";
    }

    try {
        const prompt = `You are a helpful Boston city guide assistant. Answer the following question about Boston concisely in 2-3 sentences maximum, suitable for text-to-speech. Be specific and helpful:

Question: ${question}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('[Gemini] Question:', question);
        console.log('[Gemini] Answer:', text);

        return text;
    } catch (error) {
        console.error('[Gemini] Error:', error);
        return "I'm having trouble answering that right now. Please try again.";
    }
}

/**
 * Get recommendations for a specific query (restaurants, activities, etc.)
 */
export async function getRecommendations(query: string): Promise<string> {
    if (!model) {
        return "I'm sorry, the AI assistant is not configured.";
    }

    try {
        const prompt = `You are a Boston city guide. Give 2-3 specific recommendations for: "${query}". 
Include names and brief descriptions. Keep it concise for text-to-speech (under 60 words).`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('[Gemini] Recommendations for:', query);
        console.log('[Gemini] Response:', text);

        return text;
    } catch (error) {
        console.error('[Gemini] Error:', error);
        return "I encountered an error getting recommendations.";
    }
}
