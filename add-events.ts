/**
 * Add College Events and Museums to MongoDB
 * Run with: npx tsx add-events.ts
 */
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

const MONGODB_URI = process.env.MONGODB_URI || '';

// Boston College Events - MLK Weekend 2026
const collegeEvents = [
    // MIT Events
    {
        title: "MIT Open House - Campus Tours",
        description: "Free campus tours for prospective students and families. See the iconic MIT campus.",
        start_time: "2026-01-17T10:00:00-05:00",
        end_time: "2026-01-17T16:00:00-05:00",
        venue: { name: "MIT Campus", lat: 42.3601, lng: -71.0942 },
        categories: ["college", "tour", "education", "family"],
        price: "Free",
        source: "MIT Events"
    },
    {
        title: "MIT Museum - Innovation Exhibition",
        description: "Explore the history of innovation at MIT. Interactive exhibits for all ages.",
        start_time: "2026-01-18T09:00:00-05:00",
        end_time: "2026-01-18T17:00:00-05:00",
        venue: { name: "MIT Museum", lat: 42.3621, lng: -71.0995 },
        categories: ["museum", "college", "science", "family"],
        price: "$18 adults, $10 students",
        source: "MIT Museum"
    },
    // Harvard Events
    {
        title: "Harvard Campus Walking Tour",
        description: "Explore Harvard Yard and learn about the history of America's oldest university.",
        start_time: "2026-01-17T11:00:00-05:00",
        end_time: "2026-01-17T12:30:00-05:00",
        venue: { name: "Harvard Yard", lat: 42.3744, lng: -71.1169 },
        categories: ["college", "tour", "history", "education"],
        price: "Free",
        source: "Harvard Events"
    },
    {
        title: "Harvard Art Museums - Special Exhibition",
        description: "World-class art collection featuring works from ancient to contemporary times.",
        start_time: "2026-01-18T10:00:00-05:00",
        end_time: "2026-01-18T17:00:00-05:00",
        venue: { name: "Harvard Art Museums", lat: 42.3739, lng: -71.1143 },
        categories: ["museum", "art", "college", "culture"],
        price: "$20 adults, Free for students",
        source: "Harvard Art Museums"
    },
    // Boston University
    {
        title: "BU Terriers Basketball Game",
        description: "Boston University men's basketball. Cheer on the Terriers!",
        start_time: "2026-01-18T14:00:00-05:00",
        end_time: "2026-01-18T16:00:00-05:00",
        venue: { name: "Case Gym, Boston University", lat: 42.3505, lng: -71.1054 },
        categories: ["college", "sports", "basketball"],
        price: "$15",
        source: "BU Athletics"
    },
    // Northeastern
    {
        title: "Northeastern University Info Session",
        description: "Learn about Northeastern's co-op program and campus life.",
        start_time: "2026-01-19T13:00:00-05:00",
        end_time: "2026-01-19T15:00:00-05:00",
        venue: { name: "Northeastern University", lat: 42.3398, lng: -71.0892 },
        categories: ["college", "education", "tour"],
        price: "Free",
        source: "Northeastern Admissions"
    },
    // Boston College
    {
        title: "Boston College Campus Tour",
        description: "Tour the beautiful Gothic campus of Boston College in Chestnut Hill.",
        start_time: "2026-01-17T14:00:00-05:00",
        end_time: "2026-01-17T15:30:00-05:00",
        venue: { name: "Boston College", lat: 42.3355, lng: -71.1685 },
        categories: ["college", "tour", "education"],
        price: "Free",
        source: "BC Admissions"
    },
    // WPI
    {
        title: "WPI Project Presentation Day",
        description: "See innovative student projects at Worcester Polytechnic Institute.",
        start_time: "2026-01-18T10:00:00-05:00",
        end_time: "2026-01-18T16:00:00-05:00",
        venue: { name: "WPI Campus", lat: 42.2746, lng: -71.8063 },
        categories: ["college", "tech", "education", "engineering"],
        price: "Free",
        source: "WPI Events"
    }
];

// Boston Museums
const museumEvents = [
    {
        title: "Museum of Fine Arts - Open Day",
        description: "One of the largest art museums in the US. 500,000+ works of art.",
        start_time: "2026-01-17T10:00:00-05:00",
        end_time: "2026-01-17T17:00:00-05:00",
        venue: { name: "Museum of Fine Arts", lat: 42.3394, lng: -71.0940 },
        categories: ["museum", "art", "culture", "family"],
        price: "$27 adults",
        source: "MFA Boston"
    },
    {
        title: "Museum of Science - Planetarium Show",
        description: "Charles Hayden Planetarium presents a journey through the cosmos.",
        start_time: "2026-01-18T14:00:00-05:00",
        end_time: "2026-01-18T15:00:00-05:00",
        venue: { name: "Museum of Science", lat: 42.3677, lng: -71.0711 },
        categories: ["museum", "science", "family", "education"],
        price: "$29 adults",
        source: "Museum of Science"
    },
    {
        title: "Boston Children's Museum",
        description: "Interactive exhibits for children. Climb, create, and explore!",
        start_time: "2026-01-17T09:00:00-05:00",
        end_time: "2026-01-17T17:00:00-05:00",
        venue: { name: "Boston Children's Museum", lat: 42.3516, lng: -71.0501 },
        categories: ["museum", "family", "kids", "education"],
        price: "$20",
        source: "Boston Children's Museum"
    },
    {
        title: "New England Aquarium - Penguin Feeding",
        description: "Watch the penguins get fed! Plus see sharks, sea turtles, and more.",
        start_time: "2026-01-18T11:00:00-05:00",
        end_time: "2026-01-18T11:30:00-05:00",
        venue: { name: "New England Aquarium", lat: 42.3591, lng: -71.0498 },
        categories: ["museum", "aquarium", "family", "animals"],
        price: "$34 adults",
        source: "New England Aquarium"
    },
    {
        title: "Isabella Stewart Gardner Museum",
        description: "Art museum in a Venetian-style palace with a stunning courtyard.",
        start_time: "2026-01-19T11:00:00-05:00",
        end_time: "2026-01-19T17:00:00-05:00",
        venue: { name: "Isabella Stewart Gardner Museum", lat: 42.3382, lng: -71.0990 },
        categories: ["museum", "art", "culture", "history"],
        price: "$20 adults",
        source: "Gardner Museum"
    },
    {
        title: "USS Constitution Museum",
        description: "Explore the history of 'Old Ironsides', the world's oldest commissioned warship afloat.",
        start_time: "2026-01-17T10:00:00-05:00",
        end_time: "2026-01-17T17:00:00-05:00",
        venue: { name: "USS Constitution Museum", lat: 42.3725, lng: -71.0566 },
        categories: ["museum", "history", "military", "family"],
        price: "Free (donations appreciated)",
        source: "USS Constitution Museum"
    },
    {
        title: "Institute of Contemporary Art - Free Thursday",
        description: "Contemporary art museum with harbor views. Free admission on Thursdays!",
        start_time: "2026-01-17T10:00:00-05:00",
        end_time: "2026-01-17T21:00:00-05:00",
        venue: { name: "ICA Boston", lat: 42.3522, lng: -71.0428 },
        categories: ["museum", "art", "contemporary", "free"],
        price: "Free on Thursdays",
        source: "ICA Boston"
    },
    {
        title: "Boston Tea Party Ships & Museum",
        description: "Relive the famous Boston Tea Party! Interactive museum experience.",
        start_time: "2026-01-18T10:00:00-05:00",
        end_time: "2026-01-18T17:00:00-05:00",
        venue: { name: "Boston Tea Party Ships & Museum", lat: 42.3522, lng: -71.0512 },
        categories: ["museum", "history", "interactive", "family"],
        price: "$32 adults",
        source: "Boston Tea Party Museum"
    }
];

async function addEvents() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }

    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db('boston_database');
        const collection = db.collection('boston_events');

        // Add unique IDs
        const allEvents = [...collegeEvents, ...museumEvents].map((event, idx) => ({
            ...event,
            id: `custom_${Date.now()}_${idx}`,
            source_url: ''
        }));

        // Insert events
        const result = await collection.insertMany(allEvents);
        console.log(`✓ Added ${result.insertedCount} events`);

        // Show what was added
        console.log('\nCollege Events added:');
        collegeEvents.forEach(e => console.log(`  - ${e.title}`));
        console.log('\nMuseum Events added:');
        museumEvents.forEach(e => console.log(`  - ${e.title}`));

        // Count total events
        const total = await collection.countDocuments();
        console.log(`\n✓ Total events in database: ${total}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

addEvents();
