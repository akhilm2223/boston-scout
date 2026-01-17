#!/usr/bin/env python3
"""
Convert MBTA shapefiles (ARC and NODE) to GeoJSON format
"""

import json
import sys
from pathlib import Path

try:
    import shapefile
except ImportError:
    print("Installing pyshp...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyshp"])
    import shapefile

try:
    from pyproj import Transformer
except ImportError:
    print("Installing pyproj...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyproj"])
    from pyproj import Transformer

# Create transformer from NAD83 StatePlane Massachusetts (EPSG:26986) to WGS84
transformer = Transformer.from_crs("EPSG:26986", "EPSG:4326", always_xy=True)

def transform_coordinates(lon, lat):
    """Transform from UTM Zone 19N to WGS84 lat/lon"""
    try:
        lng, latitude = transformer.transform(lon, lat)
        return [lng, latitude]
    except Exception as e:
        print(f"Warning: Could not transform coordinate ({lon}, {lat}): {e}")
        return [lon, lat]

def convert_shapefile_to_geojson(shp_path):
    """Convert a shapefile to GeoJSON format with coordinate transformation"""
    shf = shapefile.Reader(str(shp_path))
    
    features = []
    for i, shp_record in enumerate(shf.shapeRecords()):
        shape = shp_record.shape
        record = shp_record.record
        
        # Convert shape to GeoJSON geometry
        if shape.shapeType == shapefile.POLYLINE:
            # Convert parts to proper coordinate arrays
            coords = []
            points = list(shape.points)
            parts = list(shape.parts)
            
            for part_idx, part_start in enumerate(parts):
                part_end = parts[part_idx + 1] if part_idx + 1 < len(parts) else len(points)
                # Transform coordinates from UTM to WGS84
                part_coords = [transform_coordinates(pt[0], pt[1]) for pt in points[part_start:part_end]]
                coords.append(part_coords)
            
            geometry = {
                "type": "MultiLineString",
                "coordinates": coords
            }
        elif shape.shapeType == shapefile.POINT:
            # Handle Point shape
            point = shape.points[0] if shape.points else [0, 0]
            transformed = transform_coordinates(point[0], point[1])
            geometry = {
                "type": "Point",
                "coordinates": transformed
            }
        elif shape.shapeType == shapefile.POLYGON:
            # Convert parts to proper coordinate arrays
            coords = []
            points = list(shape.points)
            parts = list(shape.parts)
            
            for part_idx, part_start in enumerate(parts):
                part_end = parts[part_idx + 1] if part_idx + 1 < len(parts) else len(points)
                # Transform coordinates from UTM to WGS84
                part_coords = [transform_coordinates(pt[0], pt[1]) for pt in points[part_start:part_end]]
                coords.append(part_coords)
            
            geometry = {
                "type": "Polygon",
                "coordinates": coords
            }
        else:
            print(f"Unsupported shape type: {shape.shapeType}")
            continue
        
        # Extract attributes
        properties = {}
        field_names = [field[0] for field in shf.fields[1:]]
        for j, field_name in enumerate(field_names):
            val = record[j]
            # Convert to JSON-serializable type
            if isinstance(val, (int, float, str, bool, type(None))):
                properties[field_name] = val
            else:
                properties[field_name] = str(val)
        
        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": properties
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }

def main():
    base_path = Path(__file__).parent.parent / "public" / "mbta_rapid_transit"
    output_path = Path(__file__).parent.parent / "src" / "data"
    
    # Convert MBTA_ARC (transit lines)
    arc_shp = base_path / "MBTA_ARC.shp"
    arc_geojson = convert_shapefile_to_geojson(arc_shp)
    
    arc_output = output_path / "mbtaArcTracks.ts"
    with open(arc_output, 'w') as f:
        f.write("// Auto-generated from MBTA_ARC.shp\n")
        f.write("export const MBTA_ARC_TRACKS: GeoJSON.FeatureCollection = ")
        f.write(json.dumps(arc_geojson, indent=2))
        f.write(";\n")
    
    print(f"✓ Converted MBTA_ARC to {arc_output}")
    
    # Convert MBTA_NODE (stations)
    node_shp = base_path / "MBTA_NODE.shp"
    node_geojson = convert_shapefile_to_geojson(node_shp)
    
    node_output = output_path / "mbtaNodeStations.ts"
    with open(node_output, 'w') as f:
        f.write("// Auto-generated from MBTA_NODE.shp\n")
        f.write("export const MBTA_NODE_STATIONS: GeoJSON.FeatureCollection = ")
        f.write(json.dumps(node_geojson, indent=2))
        f.write(";\n")
    
    print(f"✓ Converted MBTA_NODE to {node_output}")
    
    print("\nConversion complete! Now update Map3D.tsx to use the new data sources.")

if __name__ == "__main__":
    main()
