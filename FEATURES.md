# Boston 3D City - Features

## Layer Toggle System ✨

### Top Center Controls
Two toggle buttons to control what's visible on the map:

**🚇 Transit Button**
- Shows/hides all MBTA transit layers
- Trains, subways, buses, ferries
- Track lines and stations
- Real-time vehicle positions

**🍴 Restaurants Button**
- Shows/hides all 3,008 restaurant markers
- Color-coded by rating:
  - 🟢 Green: 4.5+ stars (excellent)
  - 🔵 Blue: 4.0-4.5 stars (great)
  - 🟠 Amber: 3.5-4.0 stars (good)
  - 🔴 Red: <3.5 stars (average)

### Toggle States
- **Both Active**: See transit + restaurants together
- **Transit Only**: Just MBTA system
- **Restaurants Only**: Just food spots
- **Both Off**: Clean map view

## Restaurant Features

### Click Any Restaurant Marker
Popup shows:
- Name & address
- Rating & review count
- Price level ($-$$$$)
- Categories (Italian, Seafood, etc.)
- Features:
  - Dine-in / Takeout / Delivery
  - Reservations available
  - Outdoor seating
  - Good for groups
- Phone number (clickable to call)
- Google Maps link

### Zoom Behavior
- **Zoom 13+**: Restaurant markers appear
- **Zoom 15+**: Restaurant names show
- **Zoom 17+**: Full details visible

## Transit Features

### Real-Time Tracking
- Live vehicle positions (updated every 8 seconds)
- 3D train models with route colors
- Speed-based animations
- Occupancy status (crowding levels)

### Route Lines
- Static MBTA track geometry
- Color-coded by route
- Vascular "flow" visualization
- Delay indicators

## Map Controls

### Top Left
**Back to WPI** - Fly to Worcester Union Station

### Top Right
**Full Map / Downtown** - Toggle between:
- Boston downtown view (zoomed in)
- Worcester-Boston corridor (full view)

### Bottom Right
Standard Mapbox controls:
- Zoom in/out
- Compass/bearing reset
- 3D pitch control

## Data Sources

**Restaurants**: 3,008 from MongoDB
- Boston city database
- Google Places data
- Full amenity info

**Transit**: MBTA V3 API
- Real-time vehicle positions
- Route shapes & stops
- Service alerts
- Predictions

## Performance

- Restaurants load once on startup
- Transit updates every 8 seconds
- Smooth 60fps animations
- Efficient layer toggling (instant)

## Use Cases

### For Parents/Students
- Find restaurants near WPI/Boston
- See transit options
- Plan itineraries
- Check ratings before visiting

### For Developers
- Clean API endpoints
- GeoJSON data format
- Extensible layer system
- Easy to add more data sources
