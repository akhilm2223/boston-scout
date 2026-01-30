import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../src/data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SOURCES = [
    {
        name: 'nycSubwayRoutes.geojson',
        url: 'https://raw.githubusercontent.com/python-visualization/folium/master/examples/data/subway.json'
    },
    {
        name: 'nycSubwayStations.geojson',
        url: 'https://raw.githubusercontent.com/chriswhong/nyct-subway/master/data/subway_stations.geojson'
    }
];

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: Status Code ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function main() {
    console.log('Downloading NYC Subway Data...');

    for (const source of SOURCES) {
        const dest = path.join(DATA_DIR, source.name);
        console.log(`Fetching ${source.name}...`);
        try {
            await downloadFile(source.url, dest);
            console.log(`✓ Saved to ${dest}`);
        } catch (err) {
            console.error(`✗ Error downloading ${source.name}:`, err.message);
        }
    }

    console.log('Done!');
}

main();
