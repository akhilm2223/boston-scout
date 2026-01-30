import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY or VITE_GEMINI_API_KEY is not set in .env file');
    process.exit(1);
}

console.log('Found API Key length:', apiKey.length);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

async function run() {
    try {
        console.log('Sending request to Gemini...');
        const prompt = "Explain how AI is used in urban planning in one sentence.";

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Gemini API is working!');
        console.log('Response:', text);
    } catch (error) {
        console.error('❌ Error calling Gemini API:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', await error.response.text());
        } else {
            console.error(error.message);
        }
    }
}

run();
