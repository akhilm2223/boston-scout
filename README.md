# Boston Scout - 3D Transit Visualization

Real-time 3D visualization of Boston's MBTA transit system with restaurants, events, and AI-powered itinerary planning.

![Boston Scout](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Mapbox](https://img.shields.io/badge/Mapbox-GL-green)

## Features

### Transit Tracking
- **Real-time vehicle tracking** - Buses, subway, light rail, commuter rail, and ferries
- **Live track lines** - Actual MBTA route shapes with authentic route colors
- **System stress indicator** - Shows overall transit occupancy
- **Vascular flow visualization** - Cyan for healthy flow, orange for delays

### 3D Visualization
- **Cyberpunk-style map** - Dark theme with glowing buildings
- **3D building extrusions** - Interactive building highlights
- **Weather overlays** - Rain, snow, fog effects
- **Helicopter tour mode** - Automated city flyover

### Places & Discovery
- **Restaurants** - Rating-based markers with filtering
- **Events** - Local happenings from Reddit and other sources
- **Vector search** - AI-powered semantic search for places

### AI Features
- **Gemini-powered itinerary optimizer** - Smart trip planning
- **Push-to-talk voice control** - Hands-free map navigation
- **Natural language commands** - Voice-driven interactions

### UI/UX
- **Split-screen dashboard** - Map with itinerary panel
- **Interactive popups** - Click stops for details, images, and times
- **Welcome screen** - Guided onboarding experience

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Maps**: Mapbox GL JS (3D)
- **Transit Data**: MBTA V3 API
- **AI**: Google Gemini, ElevenLabs
- **Database**: MongoDB with vector search
- **Backend**: Node.js/Express

## Color Scheme

| Element | Color | Hex |
|---------|-------|-----|
| Healthy Transit | Electric Cyan | `#00f3ff` |
| Delayed Transit | Deep Orange | `#ff3d00` |
| Excellent Rating (4.5+) | Green | `#10b981` |
| Great Rating (4.0-4.5) | Blue | `#3b82f6` |
| Good Rating (3.5-4.0) | Amber | `#f59e0b` |
| Average Rating (<3.5) | Red | `#ef4444` |

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/akhilm2223/boston-scout.git
   cd boston-scout
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (see `.env.template`):
   ```env
   VITE_MAPBOX_TOKEN=your_mapbox_token
   VITE_MBTA_API_KEY=your_mbta_api_key
   MONGODB_URI=your_mongodb_uri
   GEMINI_API_KEY=your_gemini_key
   ELEVENLABS_API_KEY=your_elevenlabs_key
   ```

4. Run dev server:
   ```bash
   npm run dev
   ```

## API Keys

- **Mapbox**: [mapbox.com](https://mapbox.com)
- **MBTA**: [api-v3.mbta.com](https://api-v3.mbta.com)
- **Google Gemini**: [ai.google.dev](https://ai.google.dev)
- **ElevenLabs**: [elevenlabs.io](https://elevenlabs.io)

## Contributors

- [@kalxed](https://github.com/kalxed) - Kai Davidson
- [@dormfinder4-lab](https://github.com/dormfinder4-lab)
- [@ivan5355](https://github.com/ivan5355)

## License

MIT
