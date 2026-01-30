import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../src/data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Simplified NYC Subway Lines (Approximate paths for visualization)
const SUBWAY_LINES = {
    'A': { color: '#0039A6', path: [[-73.9255, 40.8688], [-74.0024, 40.7648], [-74.0090, 40.7130], [-73.9020, 40.6780], [-73.7915, 40.6600]] }, // Inwood to Far Rockaway
    'C': { color: '#0039A6', path: [[-73.9400, 40.8400], [-74.0024, 40.7648], [-74.0090, 40.7130], [-73.8750, 40.6750]] }, // 168 St to Euclid
    'E': { color: '#0039A6', path: [[-73.7900, 40.7000], [-73.9400, 40.7450], [-73.9900, 40.7600], [-74.0110, 40.7110]] }, // Jamaica to WTC
    'B': { color: '#FF6319', path: [[-73.8960, 40.8600], [-73.9600, 40.8000], [-73.9800, 40.7580], [-73.9950, 40.7200], [-73.9500, 40.6500], [-73.9600, 40.5760]] }, // Bronx to Brighton Beach
    'D': { color: '#FF6319', path: [[-73.8800, 40.8700], [-73.9600, 40.8000], [-73.9800, 40.7580], [-73.9950, 40.7200], [-74.0000, 40.6400], [-73.9800, 40.5770]] }, // Bronx to Coney Island
    'F': { color: '#FF6319', path: [[-73.8000, 40.7100], [-73.9400, 40.7500], [-73.9800, 40.7580], [-73.9950, 40.7200], [-73.9800, 40.6600], [-73.9780, 40.5770]] }, // Jamaica to Coney Island
    'M': { color: '#FF6319', path: [[-73.8900, 40.7100], [-73.9400, 40.7500], [-73.9800, 40.7580]] }, // Middle Village to Forest Hills (simplified)
    'G': { color: '#6CBE45', path: [[-73.9500, 40.7400], [-73.9550, 40.7100], [-73.9800, 40.6800], [-73.9800, 40.6600]] }, // Queens to Brooklyn (Crosstown)
    'J': { color: '#996633', path: [[-73.8050, 40.7000], [-73.9450, 40.6950], [-74.0040, 40.7080]] }, // Jamaica to Broad St
    'Z': { color: '#996633', path: [[-73.8050, 40.7000], [-73.9450, 40.6950], [-74.0040, 40.7080]] }, // Jamaica to Broad St
    'L': { color: '#A7A9AC', path: [[-74.0050, 40.7400], [-73.9800, 40.7300], [-73.9000, 40.6700]] }, // 8 Av to Canarsie
    'N': { color: '#FCCC0A', path: [[-73.9100, 40.7700], [-73.9830, 40.7600], [-73.9900, 40.7400], [-74.0100, 40.6400], [-73.9800, 40.5770]] }, // Astoria to Coney Island
    'Q': { color: '#FCCC0A', path: [[-73.9500, 40.7700], [-73.9830, 40.7600], [-73.9900, 40.7400], [-73.9700, 40.6600], [-73.9600, 40.5760]] }, // 2 Av to Coney Island
    'R': { color: '#FCCC0A', path: [[-73.8900, 40.7400], [-73.9830, 40.7600], [-73.9900, 40.7400], [-74.0200, 40.6300]] }, // Forest Hills to Bay Ridge
    '1': { color: '#EE352E', path: [[-73.9000, 40.8900], [-73.9600, 40.8000], [-73.9900, 40.7200], [-74.0140, 40.7020]] }, // Van Cortlandt to South Ferry
    '2': { color: '#EE352E', path: [[-73.8500, 40.8900], [-73.9600, 40.8000], [-73.9900, 40.7200], [-73.9500, 40.6500]] }, // Wakefield to Flatbush
    '3': { color: '#EE352E', path: [[-73.9400, 40.8200], [-73.9600, 40.8000], [-73.9900, 40.7200], [-73.8900, 40.6600]] }, // Harlem to New Lots
    '4': { color: '#00933C', path: [[-73.8900, 40.8800], [-73.9600, 40.8000], [-73.9800, 40.7500], [-73.9600, 40.6600]] }, // Woodlawn to Crown Hts
    '5': { color: '#00933C', path: [[-73.8300, 40.8900], [-73.9600, 40.8000], [-73.9800, 40.7500], [-73.9400, 40.6400]] }, // Dyre Av to Flatbush
    '6': { color: '#00933C', path: [[-73.8300, 40.8500], [-73.9600, 40.8000], [-73.9800, 40.7500], [-74.0040, 40.7130]] }, // Pelham Bay to Brooklyn Bridge
    '7': { color: '#B933AD', path: [[-73.8300, 40.7600], [-73.9400, 40.7400], [-73.9950, 40.7550]] }, // Flushing to Hudson Yards
    'S': { color: '#808183', path: [[-73.9780, 40.7527], [-73.9867, 40.7559]] } // 42 St Shuttle (example)
};

const STATIONS = [
    { id: '127', name: 'Times Sq-42 St', line: '1237NQRS', lat: 40.7559, lng: -73.9867 },
    { id: '631', name: 'Grand Central-42 St', line: '4567S', lat: 40.7527, lng: -73.9772 },
    { id: 'A32', name: 'W 4 St-Wash Sq', line: 'ABCDEFM', lat: 40.7308, lng: -74.0004 },
    { id: 'R23', name: 'Herald Sq-34 St', line: 'BDFMNQRW', lat: 40.7496, lng: -73.9880 },
    { id: 'L06', name: '1 Av', line: 'L', lat: 40.7305, lng: -73.9816 },
    { id: '120', name: '96 St', line: '123', lat: 40.7961, lng: -73.9723 },
    { id: 'R16', name: 'Queensboro Plaza', line: '7NQW', lat: 40.7504, lng: -73.9402 },
    { id: 'G22', name: 'Court Sq', line: 'EGM', lat: 40.7466, lng: -73.9442 },
    { id: '235', name: 'Atlantic Av-Barclays Ctr', line: '2345BDNQR', lat: 40.6840, lng: -73.9778 }
];

function generateGeoJSON() {
    const routesFeatures = [];
    const stationsFeatures = [];

    // Generate Routes
    for (const [line, data] of Object.entries(SUBWAY_LINES)) {
        routesFeatures.push({
            type: 'Feature',
            properties: {
                route_id: line,
                color: data.color,
                name: `Line ${line}`
            },
            geometry: {
                type: 'LineString',
                coordinates: data.path
            }
        });
    }

    // Generate Stations
    for (const station of STATIONS) {
        stationsFeatures.push({
            type: 'Feature',
            properties: {
                stop_id: station.id,
                stop_name: station.name,
                routes: station.line
            },
            geometry: {
                type: 'Point',
                coordinates: [station.lng, station.lat]
            }
        });
    }

    const routesGeoJSON = {
        type: 'FeatureCollection',
        features: routesFeatures
    };

    const stationsGeoJSON = {
        type: 'FeatureCollection',
        features: stationsFeatures
    };

    fs.writeFileSync(path.join(DATA_DIR, 'nycSubwayRoutes.geojson'), JSON.stringify(routesGeoJSON, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'nycSubwayStations.geojson'), JSON.stringify(stationsGeoJSON, null, 2));

    console.log('Generated simplified NYC Subway GeoJSON files.');
}

generateGeoJSON();
