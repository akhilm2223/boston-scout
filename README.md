# Boston 3D Transit Visualization

Real-time 3D visualization of Boston's MBTA transit system using Mapbox GL and the MBTA V3 API.

## Features

- **Real-time vehicle tracking** - Buses, subway, light rail, commuter rail, and ferries
- **3D city visualization** - Dark cyberpunk-style map with glowing buildings
- **Live track lines** - Actual MBTA route shapes with route colors
- **System stress indicator** - Shows overall transit occupancy
- **Weather overlay** - Rain, snow, fog effects
- **Coverage area** - Boston to Worcester

## Tech Stack

- React + TypeScript + Vite
- Mapbox GL JS (3D maps)
- MBTA V3 API (real-time transit data)

## Setup

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file:
   ```
   VITE_MAPBOX_TOKEN=your_mapbox_token
   VITE_MBTA_API_KEY=your_mbta_api_key
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```

## API Keys

- **Mapbox**: Get a free token at [mapbox.com](https://mapbox.com)
- **MBTA**: Get a free API key at [api-v3.mbta.com](https://api-v3.mbta.com)

## License

MIT
