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

Let me check what colors are used in the map for different elements:

Perfect! Here's a breakdown of all the colors used in your Boston 3D map:

## Color Scheme Breakdown

### **Restaurant Markers** (Rating-based)
- 🟢 **Green** `#10b981` - Excellent (4.5+ stars)
- 🔵 **Blue** `#3b82f6` - Great (4.0-4.5 stars)
- 🟠 **Amber** `#f59e0b` - Good (3.5-4.0 stars)
- 🔴 **Red** `#ef4444` - Average (<3.5 stars)
- ⚫ **Gray** `#888888` - No rating

### **Transit System** (Vascular Flow Colors)

**Healthy Flow (Fast trains):**
- 💠 **Electric Cyan** `#00f3ff` - Main trail color
- ⚪ **White** `#ffffff` - Core/brightest point
- 🔷 **Cyan Glow** `#00b8cc` - Outer glow

**Delayed/Slow Flow:**
- 🟠 **Deep Orange** `#ff3d00` - Trail color
- 🟡 **Cream** `#fff4e6` - Core
- 🔶 **Orange Glow** `#ff6b35` - Outer glow

### **MBTA Stations**
- 💠 **Cyan** `#00f3ff` - Station markers & glow
- ⚪ **White** `#ffffff` - Station core

### **Buildings**
- ⚫ **Pure Black** `#000000` - Default buildings
- 💠 **Electric Cyan** `#00f3ff` - Selected/highlighted building
- 💠 **Cyan Underglow** `#00f3ff` - Floor lighting (positive sentiment)

### **UI Controls**
- 💠 **Cyan** `#00f3ff` - Active toggle buttons, borders
- ⚫ **Dark** `rgba(10, 10, 15, 0.85)` - Button backgrounds
- ⚪ **White** - Text & icons

### **Map Background**
- 🌑 **Fog** `#0a0a0f` - Atmosphere
- 🌌 **Horizon** `#1a1a2e` - Sky gradient
- ⚫ **Space** `#000000` - Deep background

The color scheme creates a cyberpunk/vascular aesthetic with cyan for healthy transit flow and orange/red for delays, while restaurants use a standard rating color system (green=best, red=worst).