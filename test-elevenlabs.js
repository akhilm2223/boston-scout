// Quick test to verify ElevenLabs API key
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.VITE_ELEVENLABS_API_KEY;

console.log('\n🔑 Testing ElevenLabs API Key...\n');

if (!apiKey) {
    console.error('❌ ERROR: VITE_ELEVENLABS_API_KEY not found in .env file');
    process.exit(1);
}

console.log(`✓ API Key found: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);

const client = new ElevenLabsClient({ apiKey });

async function testElevenLabs() {
    try {
        console.log('\n📡 Connecting to ElevenLabs API...');

        // Use a pre-made voice ID (Rachel's actual voice ID)
        const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice

        const audioStream = await client.textToSpeech.convert(voiceId, {
            text: 'Hello from Boston! Your ElevenLabs API key is working perfectly.',
            model_id: 'eleven_turbo_v2_5'
        });

        // Collect chunks to verify we got data
        const chunks = [];
        for await (const chunk of audioStream) {
            chunks.push(chunk);
        }

        const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

        console.log('\n✅ SUCCESS! ElevenLabs API is working correctly!');
        console.log(`   - Generated audio: ${totalBytes.toLocaleString()} bytes`);
        console.log(`   - Voice: Rachel (21m00Tcm4TlvDq8ikWAM)`);
        console.log(`   - Model: eleven_turbo_v2_5 (low latency)`);
        console.log(`   - Your API key is valid and functional! 🎉\n`);

    } catch (error) {
        console.error('\n❌ ERROR: ElevenLabs API test failed');

        if (error.message && (error.message.includes('401') || error.message.includes('unauthorized'))) {
            console.error('   - Invalid API key. Please check your key at elevenlabs.io');
        } else if (error.message && (error.message.includes('quota') || error.message.includes('limit'))) {
            console.error('   - API quota exceeded. You may need to upgrade your plan.');
        } else {
            console.error(`   - ${error.message || error}`);
        }

        console.error('\n   Full error:', error);
        process.exit(1);
    }
}

testElevenLabs();
