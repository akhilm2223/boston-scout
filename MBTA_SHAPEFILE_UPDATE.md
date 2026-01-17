# Boston Transit Map Update - MBTA Shapefile Integration

## Changes Made

### 1. **Converted MBTA Shapefiles to GeoJSON**
   - **Script**: `scripts/convert_shapefiles.py`
   - Converts binary shapefile format (.shp) to JavaScript-compatible GeoJSON format
   - Created two new data files:
     - `src/data/mbtaArcTracks.ts` - Transit line segments (17,406 lines)
     - `src/data/mbtaNodeStations.ts` - Station nodes (2,726 lines)

### 2. **Updated Map3D.tsx**
   - **Import change**: 
     - Removed: `import { MBTA_STATIC_TRACKS } from '../data/mbtaStaticTracks'`
     - Added: `import { MBTA_ARC_TRACKS } from '../data/mbtaArcTracks'`
   
   - **Data source update**:
     - Changed the `mbta-tracks` GeoJSON source to use `MBTA_ARC_TRACKS` instead of hardcoded static tracks
     - Updated console logs to reflect the change from "static tracks" to "ARC tracks"
   
   - **Property handling**:
     - Updated route ID extraction to work with shapefile properties (`ROUTEID` or `routeId`)

### 3. **Shapefile Properties**
   The MBTA_ARC_TRACKS contains the following properties for each line segment:
   - `LINE`: Transit line name (e.g., "ORANGE", "RED", "BLUE")
   - `ROUTE`: Route description (e.g., "Forest Hills to Oak Grove")
   - `GRADE`: Grade/level information
   - `SHAPE_LEN`: Length of the line segment

## How It Works

The Mapbox layers already defined in Map3D.tsx will now render the actual MBTA rapid transit lines from the official shapefile data, including:
- `glow-zone` - Visual glow effect underneath buildings
- `trails-glow`, `trails-core`, `trails-head` - Animated light trails along the transit lines
- `stops-glow`, `stops-marker` - Station markers

## Next Steps (Optional)

To further enhance the visualization:
1. **Use MBTA_NODE_STATIONS**: Import and render station points using the nodal data
2. **Enhance coloring**: Map the `LINE` property to specific route colors using paint expressions
3. **Route filtering**: Use the `ROUTE` property to enable/disable specific transit routes

## Files Modified
- `/src/components/Map3D.tsx` - Updated to use shapefile-derived data
- `/scripts/convert_shapefiles.py` - Conversion script (run manually if needed)

## Files Generated
- `/src/data/mbtaArcTracks.ts` - GeoJSON feature collection of transit arcs
- `/src/data/mbtaNodeStations.ts` - GeoJSON feature collection of station nodes
