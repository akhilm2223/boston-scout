import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

let db;
let placesCollection;
let eventsCollection;
let landmarksCollection;

// Connect to MongoDB
async function connectDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✓ Connected to MongoDB');

        db = client.db('boston_database');
        placesCollection = db.collection('boston_places');
        eventsCollection = db.collection('boston_events');
        landmarksCollection = db.collection('boston_landmarks');

        const placeCount = await placesCollection.countDocuments();
        const eventCount = await eventsCollection.countDocuments();
        console.log(`✓ Found ${placeCount} places`);
        console.log(`✓ Found ${eventCount} events`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// ===========================================
// MTA GTFS-RT API (Real-time Train Positions)
// ===========================================

// MTA feed URLs with API key
const MTA_API_KEY = process.env.MTA_API_KEY || '';
const MTA_FEEDS = {
  'ace': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  'bdfm': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  'g': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  'jz': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  'nqrw': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  '1234567': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
  'l': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  'si': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si'
};



// ===========================================
// PROCESSED TRAINS ENDPOINT (For LERP-based tracking)
// ===========================================

// Complete NYC Subway stop coordinates (~300 stops for full coverage)
const NYC_STOPS = {
  // 1/2/3 Line (Broadway-Seventh Avenue)
  "101": { lat: 40.9030, lng: -73.9075, name: "Van Cortlandt Park-242 St" },
  "103": { lat: 40.8920, lng: -73.8983, name: "238 St" },
  "104": { lat: 40.8844, lng: -73.8988, name: "231 St" },
  "106": { lat: 40.8776, lng: -73.9047, name: "Marble Hill-225 St" },
  "107": { lat: 40.8692, lng: -73.9111, name: "215 St" },
  "108": { lat: 40.8608, lng: -73.9146, name: "207 St" },
  "109": { lat: 40.8528, lng: -73.9274, name: "Dyckman St" },
  "110": { lat: 40.8495, lng: -73.9358, name: "191 St" },
  "111": { lat: 40.8466, lng: -73.9409, name: "181 St" },
  "112": { lat: 40.8400, lng: -73.9398, name: "168 St-Washington Hts" },
  "113": { lat: 40.8335, lng: -73.9444, name: "157 St" },
  "114": { lat: 40.8278, lng: -73.9476, name: "145 St" },
  "115": { lat: 40.8186, lng: -73.9582, name: "137 St-City College" },
  "116": { lat: 40.8142, lng: -73.9639, name: "125 St" },
  "117": { lat: 40.8075, lng: -73.9662, name: "116 St-Columbia University" },
  "118": { lat: 40.8020, lng: -73.9659, name: "Cathedral Pkwy (110 St)" },
  "119": { lat: 40.7971, lng: -73.9656, name: "103 St" },
  "120": { lat: 40.7936, lng: -73.9720, name: "96 St" },
  "121": { lat: 40.7850, lng: -73.9776, name: "86 St" },
  "122": { lat: 40.7785, lng: -73.9816, name: "79 St" },
  "123": { lat: 40.7754, lng: -73.9832, name: "72 St" },
  "124": { lat: 40.7688, lng: -73.9819, name: "66 St-Lincoln Center" },
  "125": { lat: 40.7681, lng: -73.9819, name: "59 St-Columbus Circle" },
  "126": { lat: 40.7617, lng: -73.9861, name: "50 St" },
  "127": { lat: 40.7559, lng: -73.9867, name: "Times Sq-42 St" },
  "128": { lat: 40.7502, lng: -73.9912, name: "34 St-Penn Station" },
  "129": { lat: 40.7432, lng: -73.9934, name: "28 St" },
  "130": { lat: 40.7369, lng: -73.9953, name: "23 St" },
  "131": { lat: 40.7334, lng: -73.9973, name: "18 St" },
  "132": { lat: 40.7277, lng: -74.0000, name: "14 St" },
  "133": { lat: 40.7228, lng: -74.0048, name: "Christopher St-Sheridan Sq" },
  "134": { lat: 40.7136, lng: -74.0073, name: "Houston St" },
  "135": { lat: 40.7055, lng: -74.0092, name: "Canal St" },
  "136": { lat: 40.6990, lng: -74.0091, name: "Franklin St" },
  "137": { lat: 40.7130, lng: -74.0092, name: "Chambers St" },
  "138": { lat: 40.7057, lng: -74.0130, name: "Park Place" },
  "139": { lat: 40.7128, lng: -74.0093, name: "Fulton St" },
  "140": { lat: 40.7078, lng: -74.0110, name: "Wall St" },
  "142": { lat: 40.7049, lng: -74.0093, name: "South Ferry" },
  // 2/3 Express stops in Brooklyn
  "201": { lat: 40.6774, lng: -73.9735, name: "Bergen St" },
  "204": { lat: 40.6803, lng: -73.9742, name: "Grand Army Plaza" },
  "208": { lat: 40.6665, lng: -73.9623, name: "Sterling St" },
  "210": { lat: 40.6571, lng: -73.9586, name: "Winthrop St" },
  "211": { lat: 40.6500, lng: -73.9565, name: "Church Av" },
  "213": { lat: 40.6493, lng: -73.9629, name: "Newkirk Av" },
  "227": { lat: 40.6359, lng: -73.9646, name: "Flatbush Av-Brooklyn College" },
  "228": { lat: 40.6796, lng: -73.9495, name: "Nostrand Av" },
  "229": { lat: 40.6697, lng: -73.9430, name: "Kingston Av" },
  "230": { lat: 40.6607, lng: -73.9376, name: "Crown Hts-Utica Av" },
  "231": { lat: 40.6579, lng: -73.9227, name: "Sutter Av-Rutland Rd" },
  "232": { lat: 40.6604, lng: -73.9084, name: "Saratoga Av" },
  "233": { lat: 40.6614, lng: -73.8934, name: "Rockaway Av" },
  "234": { lat: 40.6643, lng: -73.8851, name: "Junius St" },
  "235": { lat: 40.6840, lng: -73.9778, name: "Atlantic Av-Barclays Ctr" },
  "236": { lat: 40.6621, lng: -73.8695, name: "Pennsylvania Av" },
  "237": { lat: 40.6592, lng: -73.8567, name: "Van Siclen Av" },
  "238": { lat: 40.6553, lng: -73.8442, name: "New Lots Av" },
  // 4/5/6 Line (Lexington Avenue)
  "401": { lat: 40.8881, lng: -73.9014, name: "Woodlawn" },
  "402": { lat: 40.8802, lng: -73.9049, name: "Mosholu Pkwy" },
  "405": { lat: 40.8705, lng: -73.8901, name: "Burke Av" },
  "406": { lat: 40.8623, lng: -73.8897, name: "Allerton Av" },
  "407": { lat: 40.8548, lng: -73.8896, name: "Pelham Pkwy" },
  "408": { lat: 40.8493, lng: -73.8860, name: "Morris Park" },
  "409": { lat: 40.8389, lng: -73.8778, name: "E 180 St" },
  "410": { lat: 40.8297, lng: -73.8641, name: "West Farms Sq-E Tremont Av" },
  "411": { lat: 40.8291, lng: -73.8756, name: "174 St" },
  "412": { lat: 40.8232, lng: -73.8830, name: "Freeman St" },
  "413": { lat: 40.8168, lng: -73.8934, name: "Simpson St" },
  "414": { lat: 40.8118, lng: -73.9008, name: "Intervale Av" },
  "415": { lat: 40.8042, lng: -73.9071, name: "Prospect Av" },
  "416": { lat: 40.8037, lng: -73.9055, name: "Jackson Av" },
  "417": { lat: 40.7978, lng: -73.9077, name: "3 Av-138 St" },
  "418": { lat: 40.8160, lng: -73.9272, name: "138 St-Grand Concourse" },
  "419": { lat: 40.8043, lng: -73.9293, name: "125 St" },
  "621": { lat: 40.7778, lng: -73.9560, name: "86 St" },
  "622": { lat: 40.7719, lng: -73.9585, name: "77 St" },
  "623": { lat: 40.7648, lng: -73.9593, name: "68 St-Hunter College" },
  "624": { lat: 40.7619, lng: -73.9679, name: "59 St" },
  "625": { lat: 40.7582, lng: -73.9728, name: "51 St" },
  "626": { lat: 40.7512, lng: -73.9760, name: "42 St-Grand Central" },
  "627": { lat: 40.7467, lng: -73.9787, name: "33 St" },
  "628": { lat: 40.7388, lng: -73.9829, name: "28 St" },
  "629": { lat: 40.7394, lng: -73.9865, name: "23 St" },
  "630": { lat: 40.7325, lng: -73.9890, name: "14 St-Union Sq" },
  "631": { lat: 40.7528, lng: -73.9773, name: "Grand Central-42 St" },
  "632": { lat: 40.7262, lng: -73.9899, name: "Astor Pl" },
  "633": { lat: 40.7200, lng: -73.9920, name: "Bleecker St" },
  "634": { lat: 40.7138, lng: -73.9963, name: "Spring St" },
  "635": { lat: 40.7181, lng: -74.0004, name: "Canal St" },
  "636": { lat: 40.7127, lng: -74.0027, name: "Brooklyn Bridge-City Hall" },
  "637": { lat: 40.7104, lng: -74.0000, name: "Fulton St" },
  "638": { lat: 40.7076, lng: -73.9981, name: "Wall St" },
  "639": { lat: 40.7015, lng: -74.0130, name: "Bowling Green" },
  // 7 Line (Flushing)
  "701": { lat: 40.7552, lng: -73.9941, name: "Hudson Yards" },
  "702": { lat: 40.7559, lng: -73.9867, name: "Times Sq-42 St" },
  "705": { lat: 40.7561, lng: -73.9903, name: "5 Av" },
  "710": { lat: 40.7527, lng: -73.9772, name: "Grand Central-42 St" },
  "711": { lat: 40.7466, lng: -73.9583, name: "Vernon Blvd-Jackson Av" },
  "712": { lat: 40.7442, lng: -73.9512, name: "Hunters Point Av" },
  "713": { lat: 40.7467, lng: -73.9443, name: "Court Sq" },
  "714": { lat: 40.7504, lng: -73.9402, name: "Queensboro Plaza" },
  "715": { lat: 40.7536, lng: -73.9252, name: "33 St" },
  "716": { lat: 40.7534, lng: -73.9155, name: "40 St" },
  "717": { lat: 40.7507, lng: -73.9058, name: "46 St" },
  "718": { lat: 40.7487, lng: -73.8935, name: "52 St" },
  "719": { lat: 40.7466, lng: -73.8869, name: "61 St-Woodside" },
  "720": { lat: 40.7459, lng: -73.8795, name: "69 St" },
  "721": { lat: 40.7468, lng: -73.8692, name: "74 St-Broadway" },
  "722": { lat: 40.7487, lng: -73.8536, name: "82 St-Jackson Hts" },
  "723": { lat: 40.7503, lng: -73.8456, name: "90 St-Elmhurst Av" },
  "724": { lat: 40.7497, lng: -73.8763, name: "Junction Blvd" },
  "725": { lat: 40.7572, lng: -73.8301, name: "103 St-Corona Plaza" },
  "726": { lat: 40.7544, lng: -73.8215, name: "111 St" },
  "727": { lat: 40.7596, lng: -73.8300, name: "Mets-Willets Point" },
  "728": { lat: 40.7599, lng: -73.8301, name: "Flushing-Main St" },
  // A/C/E Line (Eighth Avenue)
  "A02": { lat: 40.8681, lng: -73.9177, name: "Inwood-207 St" },
  "A03": { lat: 40.8600, lng: -73.9259, name: "Dyckman St" },
  "A05": { lat: 40.8518, lng: -73.9373, name: "190 St" },
  "A06": { lat: 40.8490, lng: -73.9387, name: "181 St" },
  "A07": { lat: 40.8472, lng: -73.9396, name: "175 St" },
  "A09": { lat: 40.8406, lng: -73.9392, name: "168 St" },
  "A10": { lat: 40.8339, lng: -73.9461, name: "163 St-Amsterdam Av" },
  "A11": { lat: 40.8318, lng: -73.9494, name: "155 St" },
  "A12": { lat: 40.8194, lng: -73.9536, name: "145 St" },
  "A15": { lat: 40.8107, lng: -73.9532, name: "135 St" },
  "A16": { lat: 40.8112, lng: -73.9523, name: "125 St" },
  "A17": { lat: 40.8008, lng: -73.9578, name: "116 St" },
  "A18": { lat: 40.7960, lng: -73.9618, name: "Cathedral Pkwy (110 St)" },
  "A19": { lat: 40.7907, lng: -73.9647, name: "103 St" },
  "A20": { lat: 40.7859, lng: -73.9692, name: "96 St" },
  "A21": { lat: 40.7784, lng: -73.9718, name: "86 St" },
  "A22": { lat: 40.7759, lng: -73.9765, name: "81 St-Museum of Natural History" },
  "A24": { lat: 40.7681, lng: -73.9819, name: "72 St" },
  "A25": { lat: 40.7681, lng: -73.9819, name: "59 St-Columbus Circle" },
  "A27": { lat: 40.7574, lng: -73.9903, name: "50 St" },
  "A28": { lat: 40.7559, lng: -73.9867, name: "42 St-Port Authority Bus Terminal" },
  "A30": { lat: 40.7502, lng: -73.9934, name: "34 St-Penn Station" },
  "A31": { lat: 40.7432, lng: -73.9977, name: "23 St" },
  "A32": { lat: 40.7361, lng: -74.0006, name: "14 St" },
  "A33": { lat: 40.7308, lng: -74.0046, name: "W 4 St-Wash Sq" },
  "A34": { lat: 40.7259, lng: -74.0055, name: "Spring St" },
  "A36": { lat: 40.7191, lng: -74.0024, name: "Canal St" },
  "A38": { lat: 40.7131, lng: -74.0054, name: "Chambers St" },
  "A40": { lat: 40.7128, lng: -74.0093, name: "Fulton St" },
  "A41": { lat: 40.7127, lng: -74.0094, name: "World Trade Center" },
  "A42": { lat: 40.6924, lng: -73.9856, name: "High St" },
  "A43": { lat: 40.6923, lng: -73.9852, name: "Jay St-MetroTech" },
  "A44": { lat: 40.6859, lng: -73.9770, name: "Hoyt-Schermerhorn Sts" },
  "A46": { lat: 40.6803, lng: -73.9764, name: "Lafayette Av" },
  "A47": { lat: 40.6772, lng: -73.9742, name: "Clinton-Washington Avs" },
  "A48": { lat: 40.6735, lng: -73.9671, name: "Franklin Av" },
  "A49": { lat: 40.6743, lng: -73.9581, name: "Nostrand Av" },
  "A50": { lat: 40.6781, lng: -73.9490, name: "Kingston-Throop Avs" },
  "A51": { lat: 40.6796, lng: -73.9350, name: "Utica Av" },
  "A52": { lat: 40.6847, lng: -73.9162, name: "Ralph Av" },
  "A53": { lat: 40.6879, lng: -73.9044, name: "Rockaway Av" },
  "A54": { lat: 40.6903, lng: -73.8936, name: "Broadway Junction" },
  "A55": { lat: 40.6803, lng: -73.8826, name: "Liberty Av" },
  "A57": { lat: 40.6739, lng: -73.8714, name: "Van Siclen Av" },
  "A59": { lat: 40.6747, lng: -73.8522, name: "Shepherd Av" },
  "A60": { lat: 40.6671, lng: -73.8442, name: "Euclid Av" },
  "A61": { lat: 40.6633, lng: -73.8323, name: "Grant Av" },
  "A63": { lat: 40.6588, lng: -73.8050, name: "80 St" },
  "A64": { lat: 40.6649, lng: -73.7839, name: "88 St" },
  "A65": { lat: 40.6723, lng: -73.7548, name: "Rockaway Blvd" },
  // B/D/F/M Line (Sixth Avenue)
  "D01": { lat: 40.8670, lng: -73.8673, name: "Norwood-205 St" },
  "D03": { lat: 40.8627, lng: -73.8903, name: "Bedford Park Blvd" },
  "D04": { lat: 40.8556, lng: -73.8958, name: "Kingsbridge Rd" },
  "D05": { lat: 40.8489, lng: -73.8996, name: "Fordham Rd" },
  "D06": { lat: 40.8418, lng: -73.9008, name: "182-183 Sts" },
  "D07": { lat: 40.8349, lng: -73.9017, name: "Tremont Av" },
  "D08": { lat: 40.8242, lng: -73.9053, name: "174-175 Sts" },
  "D09": { lat: 40.8206, lng: -73.9142, name: "170 St" },
  "D10": { lat: 40.8170, lng: -73.9203, name: "167 St" },
  "D11": { lat: 40.8058, lng: -73.9308, name: "161 St-Yankee Stadium" },
  "D12": { lat: 40.7994, lng: -73.9367, name: "155 St" },
  "D13": { lat: 40.7931, lng: -73.9430, name: "145 St" },
  "D14": { lat: 40.7832, lng: -73.9500, name: "135 St" },
  "D15": { lat: 40.7752, lng: -73.9567, name: "125 St" },
  "D16": { lat: 40.7558, lng: -73.9843, name: "47-50 Sts-Rockefeller Ctr" },
  "D17": { lat: 40.7496, lng: -73.9880, name: "34 St-Herald Sq" },
  "D18": { lat: 40.7433, lng: -73.9894, name: "23 St" },
  "D19": { lat: 40.7361, lng: -73.9905, name: "14 St" },
  "D20": { lat: 40.7308, lng: -74.0046, name: "W 4 St-Wash Sq" },
  "D21": { lat: 40.7234, lng: -73.9972, name: "Broadway-Lafayette St" },
  "D22": { lat: 40.7180, lng: -73.9997, name: "Grand St" },
  "D24": { lat: 40.6840, lng: -73.9778, name: "Atlantic Av-Barclays Ctr" },
  "D25": { lat: 40.6809, lng: -73.9743, name: "7 Av" },
  "D26": { lat: 40.6763, lng: -73.9737, name: "Prospect Park" },
  "D27": { lat: 40.6598, lng: -73.9665, name: "Church Av" },
  "D28": { lat: 40.6503, lng: -73.9620, name: "Beverley Rd" },
  "D29": { lat: 40.6443, lng: -73.9584, name: "Cortelyou Rd" },
  "D30": { lat: 40.6413, lng: -73.9634, name: "Newkirk Plaza" },
  "D31": { lat: 40.6326, lng: -73.9628, name: "Avenue H" },
  "D32": { lat: 40.6292, lng: -73.9635, name: "Avenue J" },
  "D33": { lat: 40.6208, lng: -73.9592, name: "Avenue M" },
  "D34": { lat: 40.6145, lng: -73.9531, name: "Kings Hwy" },
  "D35": { lat: 40.6036, lng: -73.9609, name: "Avenue U" },
  "D37": { lat: 40.5961, lng: -73.9669, name: "Neck Rd" },
  "D38": { lat: 40.5913, lng: -73.9715, name: "Sheepshead Bay" },
  "D39": { lat: 40.5850, lng: -73.9761, name: "Brighton Beach" },
  "D40": { lat: 40.5782, lng: -73.9741, name: "Ocean Pkwy" },
  "D41": { lat: 40.5754, lng: -73.9683, name: "West 8 St-NY Aquarium" },
  "D43": { lat: 40.5753, lng: -73.9812, name: "Coney Island-Stillwell Av" },
  // G Line (Crosstown)
  "G05": { lat: 40.7467, lng: -73.9443, name: "Court Sq" },
  "G06": { lat: 40.7434, lng: -73.9370, name: "21 St" },
  "G08": { lat: 40.7370, lng: -73.9381, name: "Greenpoint Av" },
  "G09": { lat: 40.7266, lng: -73.9500, name: "Nassau Av" },
  "G10": { lat: 40.7237, lng: -73.9576, name: "Metropolitan Av" },
  "G11": { lat: 40.7134, lng: -73.9522, name: "Broadway" },
  "G12": { lat: 40.7038, lng: -73.9506, name: "Flushing Av" },
  "G13": { lat: 40.6996, lng: -73.9598, name: "Myrtle-Willoughby Avs" },
  "G14": { lat: 40.6909, lng: -73.9590, name: "Bedford-Nostrand Avs" },
  "G15": { lat: 40.6880, lng: -73.9616, name: "Classon Av" },
  "G16": { lat: 40.6851, lng: -73.9600, name: "Clinton-Washington Avs" },
  "G18": { lat: 40.6881, lng: -73.9800, name: "Fulton St" },
  "G19": { lat: 40.6873, lng: -73.9799, name: "Hoyt-Schermerhorn Sts" },
  "G20": { lat: 40.6844, lng: -73.9900, name: "Bergen St" },
  "G21": { lat: 40.6810, lng: -73.9952, name: "Carroll St" },
  "G22": { lat: 40.6766, lng: -73.9966, name: "Smith-9 Sts" },
  "G24": { lat: 40.6701, lng: -73.9893, name: "4 Av-9 St" },
  "G26": { lat: 40.6606, lng: -73.9758, name: "7 Av-Park Slope" },
  "G28": { lat: 40.6615, lng: -73.9838, name: "15 St-Prospect Park" },
  "G29": { lat: 40.6601, lng: -73.9933, name: "Fort Hamilton Pkwy" },
  "G30": { lat: 40.6556, lng: -73.9987, name: "Church Av" },
  // J/Z Line (Nassau Street)
  "J12": { lat: 40.7027, lng: -74.0133, name: "Broad St" },
  "J13": { lat: 40.7139, lng: -74.0027, name: "Fulton St" },
  "J14": { lat: 40.7131, lng: -74.0054, name: "Chambers St" },
  "J15": { lat: 40.7073, lng: -73.9994, name: "Canal St" },
  "J17": { lat: 40.7180, lng: -73.9881, name: "Bowery" },
  "J19": { lat: 40.7123, lng: -73.9814, name: "Delancey St-Essex St" },
  "J20": { lat: 40.7001, lng: -73.9574, name: "Marcy Av" },
  "J21": { lat: 40.6935, lng: -73.9500, name: "Hewes St" },
  "J22": { lat: 40.6909, lng: -73.9440, name: "Lorimer St" },
  "J23": { lat: 40.6889, lng: -73.9388, name: "Flushing Av" },
  "J24": { lat: 40.6871, lng: -73.9341, name: "Myrtle Av" },
  "J27": { lat: 40.6814, lng: -73.9164, name: "Kosciuszko St" },
  "J28": { lat: 40.6789, lng: -73.9072, name: "Gates Av" },
  "J29": { lat: 40.6780, lng: -73.9036, name: "Halsey St" },
  "J30": { lat: 40.6780, lng: -73.8987, name: "Chauncey St" },
  "J31": { lat: 40.6789, lng: -73.8884, name: "Broadway Junction" },
  "J32": { lat: 40.6778, lng: -73.8752, name: "Alabama Av" },
  "J33": { lat: 40.6753, lng: -73.8630, name: "Van Siclen Av" },
  "J34": { lat: 40.6722, lng: -73.8534, name: "Cleveland St" },
  "J35": { lat: 40.6678, lng: -73.8453, name: "Norwood Av" },
  "J36": { lat: 40.6628, lng: -73.8368, name: "Crescent St" },
  "J37": { lat: 40.6524, lng: -73.8316, name: "Cypress Hills" },
  "J38": { lat: 40.6484, lng: -73.8178, name: "75 St-Elderts Ln" },
  "J39": { lat: 40.6447, lng: -73.8059, name: "Woodhaven Blvd" },
  "J40": { lat: 40.6413, lng: -73.7929, name: "104 St" },
  "J41": { lat: 40.6395, lng: -73.7865, name: "111 St" },
  "J42": { lat: 40.6364, lng: -73.7679, name: "121 St" },
  // L Line (Canarsie)
  "L01": { lat: 40.7411, lng: -74.0016, name: "8 Av" },
  "L02": { lat: 40.7381, lng: -73.9972, name: "6 Av" },
  "L03": { lat: 40.7348, lng: -73.9906, name: "14 St-Union Sq" },
  "L05": { lat: 40.7318, lng: -73.9858, name: "3 Av" },
  "L06": { lat: 40.7305, lng: -73.9816, name: "1 Av" },
  "L08": { lat: 40.7224, lng: -73.9517, name: "Bedford Av" },
  "L10": { lat: 40.7149, lng: -73.9504, name: "Lorimer St" },
  "L11": { lat: 40.7066, lng: -73.9383, name: "Graham Av" },
  "L12": { lat: 40.7034, lng: -73.9321, name: "Grand St" },
  "L13": { lat: 40.7023, lng: -73.9277, name: "Montrose Av" },
  "L14": { lat: 40.7012, lng: -73.9196, name: "Morgan Av" },
  "L15": { lat: 40.7004, lng: -73.9143, name: "Jefferson St" },
  "L16": { lat: 40.6996, lng: -73.9058, name: "DeKalb Av" },
  "L17": { lat: 40.6987, lng: -73.8986, name: "Myrtle-Wyckoff Avs" },
  "L19": { lat: 40.6975, lng: -73.8853, name: "Halsey St" },
  "L20": { lat: 40.6939, lng: -73.8763, name: "Wilson Av" },
  "L21": { lat: 40.6903, lng: -73.8668, name: "Bushwick Av-Aberdeen St" },
  "L22": { lat: 40.6866, lng: -73.8569, name: "Broadway Junction" },
  "L24": { lat: 40.6856, lng: -73.8434, name: "Atlantic Av" },
  "L25": { lat: 40.6802, lng: -73.8297, name: "Sutter Av" },
  "L26": { lat: 40.6689, lng: -73.8185, name: "Livonia Av" },
  "L27": { lat: 40.6593, lng: -73.9022, name: "New Lots Av" },
  "L28": { lat: 40.6472, lng: -73.9017, name: "E 105 St" },
  "L29": { lat: 40.6402, lng: -73.9024, name: "Canarsie-Rockaway Pkwy" },
  // N/Q/R/W Line (Broadway)
  "R01": { lat: 40.7618, lng: -73.8270, name: "Astoria-Ditmars Blvd" },
  "R03": { lat: 40.7564, lng: -73.8328, name: "Astoria Blvd" },
  "R04": { lat: 40.7562, lng: -73.8416, name: "30 Av" },
  "R05": { lat: 40.7556, lng: -73.8500, name: "Broadway" },
  "R06": { lat: 40.7548, lng: -73.8589, name: "36 Av" },
  "R08": { lat: 40.7528, lng: -73.8697, name: "39 Av" },
  "R09": { lat: 40.7504, lng: -73.9402, name: "Queensboro Plaza" },
  "R11": { lat: 40.7559, lng: -73.9867, name: "Lexington Av/59 St" },
  "R13": { lat: 40.7619, lng: -73.9679, name: "5 Av/59 St" },
  "R14": { lat: 40.7644, lng: -73.9737, name: "57 St-7 Av" },
  "R15": { lat: 40.7617, lng: -73.9803, name: "49 St" },
  "R16": { lat: 40.7559, lng: -73.9867, name: "Times Sq-42 St" },
  "R17": { lat: 40.7496, lng: -73.9880, name: "34 St-Herald Sq" },
  "R18": { lat: 40.7450, lng: -73.9893, name: "28 St" },
  "R19": { lat: 40.7393, lng: -73.9906, name: "23 St" },
  "R20": { lat: 40.7359, lng: -73.9906, name: "14 St-Union Sq" },
  "R21": { lat: 40.7293, lng: -73.9918, name: "8 St-NYU" },
  "R22": { lat: 40.7251, lng: -73.9933, name: "Prince St" },
  "R23": { lat: 40.7234, lng: -73.9972, name: "Canal St" },
  "R24": { lat: 40.7123, lng: -74.0028, name: "City Hall" },
  "R25": { lat: 40.7106, lng: -74.0067, name: "Cortlandt St" },
  "R26": { lat: 40.7048, lng: -74.0090, name: "Rector St" },
  "R27": { lat: 40.7013, lng: -74.0134, name: "Whitehall St-South Ferry" },
  "R28": { lat: 40.6923, lng: -73.9890, name: "Court St" },
  "R29": { lat: 40.6901, lng: -73.9871, name: "Jay St-MetroTech" },
  "R30": { lat: 40.6883, lng: -73.9856, name: "DeKalb Av" },
  "R31": { lat: 40.6840, lng: -73.9778, name: "Atlantic Av-Barclays Ctr" },
  "R32": { lat: 40.6840, lng: -73.9744, name: "Union St" },
  "R33": { lat: 40.6788, lng: -73.9710, name: "9 St-4 Av" },
  "R34": { lat: 40.6696, lng: -73.9832, name: "Prospect Av" },
  "R35": { lat: 40.6616, lng: -73.9927, name: "25 St" },
  "R36": { lat: 40.6540, lng: -74.0009, name: "36 St" },
  "R39": { lat: 40.6411, lng: -74.0117, name: "45 St" },
  "R40": { lat: 40.6344, lng: -74.0182, name: "53 St" },
  "R41": { lat: 40.6284, lng: -74.0238, name: "59 St" },
  "R42": { lat: 40.6194, lng: -74.0283, name: "Bay Ridge Av" },
  "R43": { lat: 40.6135, lng: -74.0304, name: "77 St" },
  "R44": { lat: 40.6066, lng: -74.0352, name: "86 St" },
  "R45": { lat: 40.5995, lng: -74.0397, name: "Bay Ridge-95 St" },
  // S Line (Shuttle) and Rockaway
  "S01": { lat: 40.7559, lng: -73.9867, name: "Times Sq-42 St" },
  "S03": { lat: 40.7527, lng: -73.9772, name: "Grand Central-42 St" },
  "S04": { lat: 40.6802, lng: -73.9753, name: "Franklin Av" },
  "S08": { lat: 40.6655, lng: -73.9580, name: "Botanic Garden" },
  "S09": { lat: 40.6765, lng: -73.9580, name: "Prospect Park" },
  "H01": { lat: 40.6062, lng: -73.8195, name: "Rockaway Park-Beach 116 St" },
  "H02": { lat: 40.5959, lng: -73.8083, name: "Beach 105 St" },
  "H03": { lat: 40.5883, lng: -73.7964, name: "Beach 98 St" },
  "H04": { lat: 40.5853, lng: -73.7868, name: "Beach 90 St" },
  "H06": { lat: 40.5840, lng: -73.7664, name: "Beach 67 St" },
  "H07": { lat: 40.5883, lng: -73.7579, name: "Beach 60 St" },
  "H08": { lat: 40.5923, lng: -73.7501, name: "Beach 44 St" },
  "H09": { lat: 40.5967, lng: -73.7425, name: "Beach 36 St" },
  "H10": { lat: 40.6001, lng: -73.7355, name: "Beach 25 St" },
  "H11": { lat: 40.6036, lng: -73.7285, name: "Far Rockaway-Mott Av" },
  // F Line additions
  "F01": { lat: 40.7418, lng: -73.9888, name: "23 St" },
  "F02": { lat: 40.7384, lng: -73.9883, name: "14 St" },
  "F03": { lat: 40.7308, lng: -74.0046, name: "W 4 St-Wash Sq" },
  "F05": { lat: 40.7234, lng: -73.9972, name: "Broadway-Lafayette St" },
  "F06": { lat: 40.7187, lng: -73.9887, name: "2 Av" },
  "F07": { lat: 40.7123, lng: -73.9814, name: "Delancey St-Essex St" },
  "F09": { lat: 40.7147, lng: -73.9611, name: "East Broadway" },
  "F11": { lat: 40.6995, lng: -73.9445, name: "York St" },
  "F12": { lat: 40.6923, lng: -73.9875, name: "Jay St-MetroTech" },
  "F14": { lat: 40.6879, lng: -73.9799, name: "Bergen St" },
  "F15": { lat: 40.6809, lng: -73.9753, name: "Carroll St" },
  "F16": { lat: 40.6766, lng: -73.9966, name: "Smith-9 Sts" },
  "F18": { lat: 40.6701, lng: -73.9893, name: "4 Av-9 St" },
  "F20": { lat: 40.6616, lng: -73.9927, name: "7 Av" },
  "F21": { lat: 40.6601, lng: -73.9933, name: "15 St-Prospect Park" },
  "F22": { lat: 40.6556, lng: -73.9987, name: "Fort Hamilton Pkwy" },
  "F23": { lat: 40.6508, lng: -74.0049, name: "Church Av" },
  "F24": { lat: 40.6443, lng: -73.9994, name: "Ditmas Av" },
  "F25": { lat: 40.6370, lng: -73.9940, name: "18 Av" },
  "F27": { lat: 40.6287, lng: -73.9982, name: "Avenue I" },
  "F29": { lat: 40.6193, lng: -73.9989, name: "Bay Pkwy" },
  "F30": { lat: 40.6127, lng: -73.9971, name: "Avenue N" },
  "F31": { lat: 40.6026, lng: -73.9964, name: "Avenue P" },
  "F32": { lat: 40.5950, lng: -73.9947, name: "Kings Hwy" },
  "F33": { lat: 40.5918, lng: -73.9975, name: "Avenue U" },
  "F34": { lat: 40.5868, lng: -73.9980, name: "Avenue X" },
  "F35": { lat: 40.5803, lng: -73.9768, name: "Neptune Av" },
  "F36": { lat: 40.5753, lng: -73.9812, name: "Coney Island-Stillwell Av" }
};

// Fetch all trains with their current positions for LERP tracking
app.get('/api/mta/trains', async (req, res) => {
  try {
    const allTrains = [];
    const now = Math.floor(Date.now() / 1000);

    // Fetch all feeds in parallel
    const feedPromises = Object.entries(MTA_FEEDS).map(async ([feedName, feedUrl]) => {
      try {
        const response = await fetch(feedUrl, {
          headers: MTA_API_KEY ? { 'x-api-key': MTA_API_KEY } : {}
        });

        if (!response.ok) return [];

        const buffer = await response.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
          new Uint8Array(buffer)
        );

        const trains = [];

        for (const entity of feed.entity) {
          // Process TripUpdates (this is where the actual data is)
          if (entity.tripUpdate?.trip?.routeId) {
            const tripUpdate = entity.tripUpdate;
            const routeId = tripUpdate.trip.routeId;
            const tripId = tripUpdate.trip.tripId;
            const stopTimeUpdates = tripUpdate.stopTimeUpdate || [];

            if (stopTimeUpdates.length >= 1) {
              // Find the current stop (first one with future arrival)
              let currentStopIndex = 0;
              for (let i = 0; i < stopTimeUpdates.length; i++) {
                const stu = stopTimeUpdates[i];
                const arrivalTime = Number(stu.arrival?.time || stu.departure?.time || 0);
                if (arrivalTime > now) {
                  currentStopIndex = Math.max(0, i - 1);
                  break;
                }
              }

              const currentStop = stopTimeUpdates[currentStopIndex];
              const nextStop = stopTimeUpdates[currentStopIndex + 1];

              if (currentStop?.stopId) {
                // Get stop coordinates
                const stopId = currentStop.stopId.replace(/[NS]$/, ''); // Remove N/S suffix
                const currentStopCoords = NYC_STOPS[stopId];

                let nextStopCoords = null;
                let nextStopId = null;
                if (nextStop?.stopId) {
                  nextStopId = nextStop.stopId.replace(/[NS]$/, '');
                  nextStopCoords = NYC_STOPS[nextStopId];
                }

                // Calculate progress between stops
                let progress = 0;
                let status = 'STOPPED_AT';

                if (nextStop && currentStopCoords && nextStopCoords) {
                  const departureTime = Number(currentStop.departure?.time || currentStop.arrival?.time || now);
                  const arrivalTime = Number(nextStop.arrival?.time || nextStop.departure?.time || departureTime + 120);

                  if (now >= departureTime && now < arrivalTime) {
                    status = 'IN_TRANSIT_TO';
                    progress = Math.min(1, Math.max(0, (now - departureTime) / (arrivalTime - departureTime)));
                  } else if (now >= arrivalTime) {
                    progress = 1;
                  }
                }

                trains.push({
                  id: tripId,
                  routeId,
                  currentStopId: stopId,
                  currentStop: currentStopCoords,
                  nextStopId,
                  nextStop: nextStopCoords,
                  status,
                  progress,
                  departureTime: Number(currentStop.departure?.time || 0),
                  arrivalTime: nextStop ? Number(nextStop.arrival?.time || 0) : 0,
                  timestamp: now
                });
              }
            }
          }
        }

        return trains;
      } catch (err) {
        console.error(`[MTA] Error processing ${feedName}:`, err.message);
        return [];
      }
    });

    const results = await Promise.all(feedPromises);
    results.forEach(trains => allTrains.push(...trains));

    // Filter to only trains with valid coordinates
    const validTrains = allTrains.filter(t => t.currentStop);

    // Debug: count trains in each status
    const inTransit = validTrains.filter(t => t.status === 'IN_TRANSIT_TO').length;
    const stopped = validTrains.filter(t => t.status === 'STOPPED_AT').length;
    const withNextStop = validTrains.filter(t => t.nextStop).length;

    console.log(`[MTA Trains] Processed ${validTrains.length} trains: ${inTransit} in-transit, ${stopped} stopped, ${withNextStop} with next stop`);

    // Debug: log a few sample trains to verify progress
    const sampleTrains = validTrains.slice(0, 3);
    sampleTrains.forEach(t => {
      console.log(`  - ${t.routeId} train: ${t.status}, progress=${t.progress.toFixed(2)}, from=${t.currentStop?.name || t.currentStopId}`);
    });

    res.json({
      timestamp: now,
      count: validTrains.length,
      trains: validTrains
    });

  } catch (error) {
    console.error('[MTA Trains] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Fetch MTA GTFS-RT feed
app.get('/api/mta/:line', async (req, res) => {
  const line = req.params.line.toLowerCase();
  const feedUrl = MTA_FEEDS[line];

  if (!feedUrl) {
    return res.status(400).json({
      error: `Unknown line: ${line}`,
      available: Object.keys(MTA_FEEDS)
    });
  }

  try {
    const response = await fetch(feedUrl, {
      headers: MTA_API_KEY ? { 'x-api-key': MTA_API_KEY } : {}
    });

    if (!response.ok) {
      throw new Error(`MTA API returned ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // Convert to JSON
    const jsonFeed = {
      header: {
        gtfsRealtimeVersion: feed.header.gtfsRealtimeVersion,
        incrementality: feed.header.incrementality,
        timestamp: feed.header.timestamp?.toString()
      },
      entity: feed.entity.map(e => ({
        id: e.id,
        vehicle: e.vehicle ? {
          trip: e.vehicle.trip ? {
            tripId: e.vehicle.trip.tripId,
            routeId: e.vehicle.trip.routeId,
            startTime: e.vehicle.trip.startTime,
            startDate: e.vehicle.trip.startDate
          } : null,
          position: e.vehicle.position ? {
            latitude: e.vehicle.position.latitude,
            longitude: e.vehicle.position.longitude,
            bearing: e.vehicle.position.bearing,
            speed: e.vehicle.position.speed
          } : null,
          currentStopSequence: e.vehicle.currentStopSequence,
          stopId: e.vehicle.stopId,
          currentStatus: e.vehicle.currentStatus,
          timestamp: e.vehicle.timestamp?.toString()
        } : null,
        tripUpdate: e.tripUpdate ? {
          trip: e.tripUpdate.trip ? {
            tripId: e.tripUpdate.trip.tripId,
            routeId: e.tripUpdate.trip.routeId
          } : null,
          stopTimeUpdate: e.tripUpdate.stopTimeUpdate?.map(stu => ({
            stopId: stu.stopId,
            arrival: stu.arrival ? { time: stu.arrival.time?.toString() } : null,
            departure: stu.departure ? { time: stu.departure.time?.toString() } : null
          }))
        } : null
      }))
    };

    console.log(`[MTA] ${line}: ${jsonFeed.entity.filter(e => e.vehicle?.position).length} vehicles with positions`);
    res.json(jsonFeed);

  } catch (error) {
    console.error(`[MTA] Error fetching ${line}:`, error.message);
    res.status(500).json({ error: `Failed to fetch MTA feed: ${error.message}` });
  }
});

// API Routes

// Get all places
app.get('/api/places', async (req, res) => {
    try {
        const places = await placesCollection
            .find({})
            .project({
                businessname: 1,
                address: 1,
                city: 1,
                latitude: 1,
                longitude: 1,
                rating: 1,
                user_rating_count: 1,
                categories: 1,
                price_level: 1,
                phone: 1,
                website: 1,
                google_maps_url: 1,
                photo_name: 1,
                dine_in: 1,
                takeout: 1,
                delivery: 1,
                reservable: 1,
                serves_breakfast: 1,
                serves_lunch: 1,
                serves_dinner: 1,
                serves_brunch: 1,
                outdoor_seating: 1,
                good_for_groups: 1,
            })
            .toArray();

        res.json(places);
    } catch (error) {
        console.error('Error fetching places:', error);
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});

app.get('/api/landmarks', async (req, res) => {
    try {
        const landmarksCollection = db.collection('boston_landmarks');
        const landmarks = await landmarksCollection
            .find({})
            .project({
                embedding: 0
            })
            .toArray();

        console.log(`[Landmarks] Loaded ${landmarks.length} landmarks from boston_landmarks collection`);
        res.json(landmarks);
    } catch (error) {
        console.error('Error fetching landmarks:', error);
        res.status(500).json({ error: 'Failed to fetch landmarks' });
    }
});

// Get hotels (optimized for fast loading)
app.get('/api/hotels', async (req, res) => {
    try {
        const hotelsCollection = db.collection('boston-hotels');
        const hotels = await hotelsCollection
            .find({})
            .project({
                name: 1,
                address: 1,
                lat: 1,
                lng: 1,
                rating: 1,
                user_rating_count: 1,
                price_level: 1,
                photo_name: 1
            })
            .sort({ rating: -1, user_rating_count: -1 })
            .limit(50)
            .toArray();

        console.log(`[Hotels] Loaded ${hotels.length} hotels from boston-hotels collection`);

        // Map fields for frontend compatibility
        const formattedHotels = hotels.map(h => ({
            ...h,
            location: { lat: h.lat, lng: h.lng }
        }));

        res.json(formattedHotels);
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.status(500).json({ error: 'Failed to fetch hotels' });
    }
});

// Get places by filter
app.get('/api/places/filter', async (req, res) => {
    try {
        const { minRating, priceLevel, category, features } = req.query;

        const query = {};

        if (minRating) {
            query.rating = { $gte: parseFloat(minRating) };
        }

        if (priceLevel) {
            query.price_level = parseInt(priceLevel);
        }

        if (category) {
            query.categories = { $regex: category, $options: 'i' };
        }

        // Feature filters
        if (features) {
            const featureList = features.split(',');
            featureList.forEach(feature => {
                query[feature] = true;
            });
        }

        const places = await placesCollection.find(query).toArray();
        res.json(places);
    } catch (error) {
        console.error('Error filtering places:', error);
        res.status(500).json({ error: 'Failed to filter places' });
    }
});

// Get place by ID
app.get('/api/places/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Validate ObjectId format (24 hex characters)
        if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
            return res.status(400).json({ error: 'Invalid place ID format' });
        }

        const { ObjectId } = await import('mongodb');
        const place = await placesCollection.findOne({
            _id: new ObjectId(id)
        });

        if (!place) {
            return res.status(404).json({ error: 'Place not found' });
        }

        res.json(place);
    } catch (error) {
        console.error('Error fetching place:', error);
        res.status(500).json({ error: 'Failed to fetch place' });
    }
});

// Get all events
app.get('/api/events', async (req, res) => {
    try {
        const events = await eventsCollection
            .find({})
            .toArray();

        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get events by date range
app.get('/api/events/range', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const query = {};
        if (startDate || endDate) {
            query.start_time = {};
            if (startDate) query.start_time.$gte = startDate;
            if (endDate) query.start_time.$lte = endDate;
        }

        const events = await eventsCollection.find(query).toArray();
        res.json(events);
    } catch (error) {
        console.error('Error filtering events:', error);
        res.status(500).json({ error: 'Failed to filter events' });
    }
});

// AI-powered event search using Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Event categories available in the database
const EVENT_CATEGORIES = [
    'music', 'concert', 'live music',
    'sports', 'game', 'athletics',
    'arts', 'theater', 'museum', 'gallery', 'exhibition',
    'food', 'dining', 'festival', 'tastings',
    'comedy', 'standup',
    'nightlife', 'club', 'party',
    'family', 'kids', 'children',
    'outdoor', 'nature', 'parks',
    'tech', 'conference', 'workshop', 'networking',
    'community', 'social', 'meetup',
    'holiday', 'seasonal', 'celebration',
    'education', 'class', 'lecture',
    'wellness', 'fitness', 'yoga', 'health'
];

// Classify search query using Gemini
async function classifyEventQuery(userQuery) {
    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not set, using keyword extraction');
        return extractKeywords(userQuery);
    }

    try {
        const prompt = `You are an event search classifier. Extract ONLY the most relevant keywords from the user's query.

IMPORTANT: Be precise. Only include words that should appear in event titles.

User query: "${userQuery}"

Respond ONLY in this JSON format (no markdown, no code blocks):
{
  "keywords": ["exact", "words", "to", "search"],
  "dateHint": "today" | "tomorrow" | "this weekend" | "this week" | "next week" | null
}

Rules:
1. Extract the MAIN topic words only (e.g., "jazz", "music", "comedy", "food")
2. Ignore filler words like "show me", "find", "looking for", "events", "activities"
3. If user says "tonight" or "today", set dateHint to "today"
4. If user says "tomorrow", set dateHint to "tomorrow"
5. If user says "this weekend" or "saturday/sunday", set dateHint to "this weekend"

Examples:
- "jazz music tonight" -> {"keywords": ["jazz", "music"], "dateHint": "today"}
- "show me comedy shows" -> {"keywords": ["comedy"], "dateHint": null}
- "food festivals this weekend" -> {"keywords": ["food", "festival"], "dateHint": "this weekend"}
- "family activities" -> {"keywords": ["family"], "dateHint": null}`;

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return extractKeywords(userQuery);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response (handle potential markdown code blocks)
        let jsonStr = text.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }

        const parsed = JSON.parse(jsonStr);
        console.log('Gemini classification:', parsed);
        return parsed;
    } catch (error) {
        console.error('Gemini classification error:', error);
        return extractKeywords(userQuery);
    }
}

// Fallback keyword extraction
function extractKeywords(query) {
    const words = query.toLowerCase().split(/\s+/);
    const matchedCategories = EVENT_CATEGORIES.filter(cat =>
        words.some(word => cat.includes(word) || word.includes(cat))
    );

    let dateHint = null;
    if (query.includes('today')) dateHint = 'today';
    else if (query.includes('tomorrow')) dateHint = 'tomorrow';
    else if (query.includes('weekend')) dateHint = 'this weekend';
    else if (query.includes('week')) dateHint = 'this week';

    return {
        categories: matchedCategories.length > 0 ? matchedCategories : [],
        dateHint,
        keywords: words.filter(w => w.length > 2 && !EVENT_CATEGORIES.includes(w))
    };
}

// Convert date hint to date range
function getDateRange(dateHint) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateHint) {
        case 'today':
            return {
                start: today.toISOString(),
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
            };
        case 'tomorrow':
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
            return {
                start: tomorrow.toISOString(),
                end: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString()
            };
        case 'this weekend':
            const dayOfWeek = today.getDay();
            const daysToSaturday = (6 - dayOfWeek + 7) % 7 || 7;
            const saturday = new Date(today.getTime() + daysToSaturday * 24 * 60 * 60 * 1000);
            const monday = new Date(saturday.getTime() + 2 * 24 * 60 * 60 * 1000);
            return { start: saturday.toISOString(), end: monday.toISOString() };
        case 'this week':
            const endOfWeek = new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000);
            return { start: today.toISOString(), end: endOfWeek.toISOString() };
        case 'next week':
            const startNextWeek = new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000);
            const endNextWeek = new Date(startNextWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
            return { start: startNextWeek.toISOString(), end: endNextWeek.toISOString() };
        default:
            return null;
    }
}

// AI-powered event search endpoint
app.post('/api/events/search', async (req, res) => {
    try {
        const { query, startDate, endDate } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Classify the query using Gemini
        const classification = await classifyEventQuery(query);

        // Build MongoDB query
        const mongoQuery = {};

        // Build search query - prioritize keywords for precise matching
        const searchTerms = classification.keywords || [];

        if (searchTerms.length > 0) {
            // Use word boundary regex for more accurate matching
            // Match if ANY keyword appears in title (primary) or categories
            const regexPatterns = searchTerms.map(term => `\\b${term}\\b`).join('|');

            mongoQuery.$or = [
                { title: { $regex: regexPatterns, $options: 'i' } },
                { categories: { $elemMatch: { $regex: regexPatterns, $options: 'i' } } }
            ];

            console.log('Search terms:', searchTerms);
            console.log('Regex pattern:', regexPatterns);
        }

        // Date filter
        let dateRange = null;
        if (startDate && endDate) {
            dateRange = { start: startDate, end: endDate };
        } else if (classification.dateHint) {
            dateRange = getDateRange(classification.dateHint);
        }

        if (dateRange) {
            mongoQuery.start_time = {
                $gte: dateRange.start,
                $lte: dateRange.end
            };
        }

        console.log('Event search query:', JSON.stringify(mongoQuery, null, 2));

        // Execute query
        const events = await eventsCollection
            .find(mongoQuery)
            .sort({ start_time: 1 })
            .limit(50)
            .toArray();

        res.json({
            classification,
            dateRange,
            count: events.length,
            events
        });
    } catch (error) {
        console.error('Error in AI event search:', error);
        res.status(500).json({ error: 'Failed to search events' });
    }
});

// Get event categories (for UI dropdown)
app.get('/api/events/categories', async (req, res) => {
    try {
        // Get distinct categories from the database
        const categories = await eventsCollection.distinct('categories');
        res.json(categories.filter(Boolean).flat());
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// ============================================
// VECTOR SEARCH ENDPOINTS
// ============================================

const GEMINI_EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

// Cache for query embeddings
const embeddingCache = new Map();

/**
 * Get embedding for a query string using Gemini
 */
async function getQueryEmbedding(query) {
    // Check cache first
    if (embeddingCache.has(query)) {
        return embeddingCache.get(query);
    }

    try {
        const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: {
                    parts: [{ text: query }]
                }
            })
        });

        if (!response.ok) {
            console.error('Embedding API error:', response.status);
            return null;
        }

        const data = await response.json();
        const embedding = data.embedding?.values || null;

        // Cache the result
        if (embedding) {
            embeddingCache.set(query, embedding);
            // Limit cache size
            if (embeddingCache.size > 1000) {
                const firstKey = embeddingCache.keys().next().value;
                embeddingCache.delete(firstKey);
            }
        }

        return embedding;
    } catch (error) {
        console.error('Embedding error:', error);
        return null;
    }
}

/**
 * POST /api/places/vibe-search
 * Semantic vector search for places
 */
app.post('/api/places/vibe-search', async (req, res) => {
    const startTime = Date.now();

    try {
        const { query, limit = 10, filters = {}, placeType } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Define category filters for different place types
        // Restaurants: any place with food/dining related categories
        const restaurantKeywords = ['restaurant', 'food', 'dining', 'cafe', 'coffee', 'bakery', 'bar', 'pub', 'pizza', 'sushi', 'seafood', 'deli', 'brunch', 'breakfast', 'lunch', 'dinner', 'steak', 'bagel', 'dessert', 'ice cream', 'tea house', 'wine bar', 'night club', 'confectionery', 'butcher', 'grocery', 'supermarket', 'liquor', 'catering', 'meal'];
        // Landmarks: non-food places like attractions, venues, hotels, etc.
        const landmarkKeywords = ['stadium', 'arena', 'tourist attraction', 'hotel', 'lodging', 'hospital', 'sports complex', 'athletic field', 'sports activity', 'bowling', 'event venue', 'bed and breakfast', 'market', 'florist', 'corporate office', 'store'];

        // Get embedding for the query  
        const queryEmbedding = await getQueryEmbedding(query);

        let results;

        if (placeType === 'landmark') {
            const landmarksCollection = db.collection('boston_landmarks');
            console.log(`[VibeSearch] Searching landmarks for: ${query}`);
            const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
            const regexPattern = searchTerms.join('|');

            const searchTarget = query.toLowerCase() === 'popular boston' || query.toLowerCase() === 'popular restaurant boston' ? {} : {
                $or: [
                    { name: { $regex: regexPattern, $options: 'i' } },
                    { categories: { $regex: regexPattern, $options: 'i' } },
                    { primary_category: { $regex: regexPattern, $options: 'i' } }
                ]
            };

            const rawLandmarks = await landmarksCollection
                .find(searchTarget)
                .sort({ rating: -1, user_rating_count: -1 })
                .limit(limit)
                .toArray();

            // Map fields to match places schema for frontend compatibility
            results = rawLandmarks.map(l => ({
                ...l,
                businessname: l.name,
                latitude: l.lat?.toString(),
                longitude: l.lng?.toString(),
                type: 'place'
            }));
        } else if (queryEmbedding) {
            // Use vector search if embedding is available for places
            const pipeline = [
                {
                    $vectorSearch: {
                        index: 'vibe_index',
                        path: 'embedding',
                        queryVector: queryEmbedding,
                        numCandidates: 150,
                        limit: limit * 3 // Fetch more to filter by type
                    }
                },
                {
                    $addFields: {
                        score: { $meta: 'vectorSearchScore' }
                    }
                }
            ];

            // Add placeType filter (only for restaurant or all)
            if (placeType === 'restaurant') {
                // Restaurants: places with food-related categories
                pipeline.push({
                    $match: {
                        categories: { $elemMatch: { $regex: restaurantKeywords.join('|'), $options: 'i' } }
                    }
                });
            }

            // Add filters if provided
            if (filters.categories && filters.categories.length > 0) {
                pipeline.push({
                    $match: {
                        categories: { $regex: filters.categories.join('|'), $options: 'i' }
                    }
                });
            }

            if (filters.minRating) {
                pipeline.push({
                    $match: { rating: { $gte: filters.minRating } }
                });
            }

            if (filters.maxPriceLevel) {
                pipeline.push({
                    $match: { price_level: { $lte: filters.maxPriceLevel } }
                });
            }

            // Limit results after filtering
            pipeline.push({ $limit: limit });

            // Project only needed fields
            pipeline.push({
                $project: {
                    embedding: 0 // Exclude large embedding array from response
                }
            });

            results = await placesCollection.aggregate(pipeline).toArray();
        } else {
            // Fallback to text search if embedding fails
            console.log('Falling back to text search for:', query);
            const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
            const regexPattern = searchTerms.join('|');

            results = await placesCollection
                .find({
                    $or: [
                        { businessname: { $regex: regexPattern, $options: 'i' } },
                        { categories: { $regex: regexPattern, $options: 'i' } }
                    ]
                })
                .limit(limit)
                .project({ embedding: 0 })
                .toArray();
        }

        const took_ms = Date.now() - startTime;

        res.json({
            results,
            query,
            count: results.length,
            took_ms
        });

    } catch (error) {
        console.error('Vibe search error:', error);
        res.status(500).json({ error: 'Failed to search places' });
    }
});

/**
 * GET /api/places/hero
 * Get hero options based on transit speed and time of day
 */
app.get('/api/places/hero', async (req, res) => {
    try {
        const { query, transitSpeed = 50 } = req.query;
        const hour = new Date().getHours();
        const speed = parseInt(transitSpeed);

        // Determine city pulse
        let cityPulse;
        if (speed < 25) cityPulse = 'slow';
        else if (speed < 50) cityPulse = 'moderate';
        else if (speed < 75) cityPulse = 'active';
        else cityPulse = 'busy';

        // Determine time-based options
        let timeContext;
        if (hour >= 6 && hour < 11) timeContext = 'morning';
        else if (hour >= 11 && hour < 14) timeContext = 'lunch';
        else if (hour >= 14 && hour < 17) timeContext = 'afternoon';
        else if (hour >= 17 && hour < 21) timeContext = 'dinner';
        else timeContext = 'night';

        // Generate options based on context
        const optionSets = {
            morning: [
                { id: 'coffee', emoji: '☕', label: 'Coffee', query: 'coffee cafe morning breakfast' },
                { id: 'brunch', emoji: '🥞', label: 'Brunch', query: 'brunch breakfast eggs' },
                { id: 'bakery', emoji: '🥐', label: 'Bakery', query: 'bakery pastry fresh' },
                { id: 'parks', emoji: '🌳', label: 'Parks', query: 'park outdoor morning walk' }
            ],
            lunch: [
                { id: 'quick', emoji: '🥪', label: 'Quick Bite', query: 'lunch quick sandwich fast casual' },
                { id: 'healthy', emoji: '🥗', label: 'Healthy', query: 'salad healthy lunch light' },
                { id: 'asian', emoji: '🍜', label: 'Asian', query: 'asian noodles ramen pho' },
                { id: 'deli', emoji: '🥓', label: 'Deli', query: 'deli sandwich sub lunch' }
            ],
            afternoon: [
                { id: 'coffee', emoji: '☕', label: 'Coffee', query: 'coffee afternoon cafe' },
                { id: 'dessert', emoji: '🍰', label: 'Dessert', query: 'dessert sweet bakery ice cream' },
                { id: 'happy', emoji: '🍺', label: 'Happy Hour', query: 'bar happy hour drinks' },
                { id: 'museum', emoji: '🏛️', label: 'Museums', query: 'museum gallery art culture' }
            ],
            dinner: [
                { id: 'italian', emoji: '🍝', label: 'Italian', query: 'italian pasta dinner romantic' },
                { id: 'seafood', emoji: '🦞', label: 'Seafood', query: 'seafood lobster oyster boston' },
                { id: 'steakhouse', emoji: '🥩', label: 'Steakhouse', query: 'steak steakhouse dinner upscale' },
                { id: 'datenight', emoji: '🕯️', label: 'Date Night', query: 'romantic dinner date cozy' }
            ],
            night: [
                { id: 'bars', emoji: '🍸', label: 'Bars', query: 'bar cocktails nightlife drinks' },
                { id: 'live', emoji: '🎵', label: 'Live Music', query: 'live music concert jazz' },
                { id: 'club', emoji: '🪩', label: 'Clubs', query: 'club dance nightclub party' },
                { id: 'latenight', emoji: '🌙', label: 'Late Night', query: 'late night food open late' }
            ]
        };

        let options = [...optionSets[timeContext]];

        // Adjust based on pulse
        if (cityPulse === 'busy') {
            options[0] = { id: 'trending', emoji: '🔥', label: 'Trending', query: 'popular trending busy crowded' };
        } else if (cityPulse === 'slow') {
            options[3] = { id: 'quiet', emoji: '🤫', label: 'Quiet Spots', query: 'quiet peaceful relaxed hidden gem' };
        }

        res.json({
            options,
            transitSpeed: speed,
            cityPulse,
            timeContext
        });

    } catch (error) {
        console.error('Hero options error:', error);
        res.status(500).json({ error: 'Failed to get hero options' });
    }
});

/**
 * GET /api/places/infinite
 * Cursor-based pagination for virtual scrolling
 */
app.get('/api/places/infinite', async (req, res) => {
    try {
        const { cursor, limit = 10, query } = req.query;
        const limitNum = Math.min(parseInt(limit) || 10, 50);

        let matchQuery = {};
        let searchFilter = null;

        // If there's a search query, filter by it
        if (query && query.trim()) {
            const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
            if (searchTerms.length > 0) {
                const regexPattern = searchTerms.join('|');
                searchFilter = {
                    $or: [
                        { businessname: { $regex: regexPattern, $options: 'i' } },
                        { categories: { $regex: regexPattern, $options: 'i' } }
                    ]
                };
            }
        }

        // Build final query - combine search filter and cursor
        if (cursor) {
            const cleanCursor = String(cursor).trim();

            // Validate cursor is a valid ObjectId format (24 hex characters)
            if (cleanCursor && /^[0-9a-fA-F]{24}$/.test(cleanCursor)) {
                const { ObjectId } = await import('mongodb');
                const cursorFilter = { _id: { $gt: new ObjectId(cleanCursor) } };

                if (searchFilter) {
                    matchQuery = { $and: [searchFilter, cursorFilter] };
                } else {
                    matchQuery = cursorFilter;
                }
            } else {
                // Invalid cursor - just use search filter if present
                console.log('[Infinite] Invalid cursor format, ignoring:', cleanCursor?.substring(0, 30));
                if (searchFilter) {
                    matchQuery = searchFilter;
                }
            }
        } else if (searchFilter) {
            matchQuery = searchFilter;
        }

        const items = await placesCollection
            .find(matchQuery)
            .sort({ _id: 1 })
            .limit(limitNum + 1) // Fetch one extra to check if there's more
            .project({ embedding: 0 })
            .toArray();

        const hasMore = items.length > limitNum;
        if (hasMore) {
            items.pop(); // Remove the extra item
        }

        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

        // Get total count for the search (not affected by cursor)
        const countQuery = searchFilter || {};
        const total = await placesCollection.countDocuments(countQuery);

        res.json({
            items,
            nextCursor,
            hasMore,
            total
        });

    } catch (error) {
        console.error('Infinite scroll error:', error);
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});

// ============================================
// EVENTS VECTOR SEARCH
// ============================================

/**
 * POST /api/events/vibe-search
 * Semantic vector search for events
 */
app.post('/api/events/vibe-search', async (req, res) => {
    const startTime = Date.now();

    try {
        const { query, limit = 50, filters = {} } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const queryEmbedding = await getQueryEmbedding(query);
        let results;
        let searchMethod = 'text';

        if (queryEmbedding) {
            try {
                const pipeline = [
                    {
                        $vectorSearch: {
                            index: 'events_vibe_index',
                            path: 'embedding',
                            queryVector: queryEmbedding,
                            numCandidates: 200,
                            limit: limit
                        }
                    },
                    {
                        $addFields: {
                            score: { $meta: 'vectorSearchScore' }
                        }
                    }
                ];

                // Date filter
                if (filters.startDate) {
                    pipeline.push({
                        $match: { start_time: { $gte: filters.startDate } }
                    });
                }

                // Category filter
                if (filters.categories && filters.categories.length > 0) {
                    pipeline.push({
                        $match: {
                            categories: { $elemMatch: { $regex: filters.categories.join('|'), $options: 'i' } }
                        }
                    });
                }

                pipeline.push({ $project: { embedding: 0 } });

                results = await eventsCollection.aggregate(pipeline).toArray();
                searchMethod = 'vector';
                console.log(`[Events] Vector search for "${query}" returned ${results.length} results`);
            } catch (vectorErr) {
                // Vector search failed (index might not exist), fallback to text search
                console.warn('[Events] Vector search failed, falling back to text search:', vectorErr.message);
                results = null;
            }
        }

        // Fallback to text search if vector search failed or no embedding
        if (!results) {
            console.log('[Events] Using text search for:', query);
            const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

            let findQuery = {};
            if (searchTerms.length > 0) {
                const regexPattern = searchTerms.join('|');
                findQuery = {
                    $or: [
                        { title: { $regex: regexPattern, $options: 'i' } },
                        { description: { $regex: regexPattern, $options: 'i' } },
                        { 'venue.name': { $regex: regexPattern, $options: 'i' } },
                        { category: { $regex: regexPattern, $options: 'i' } }
                    ]
                };
            }

            results = await eventsCollection
                .find(findQuery)
                .sort({ start_time: 1 }) // Sort by upcoming first
                .limit(limit)
                .project({ embedding: 0 })
                .toArray();

            console.log(`[Events] Text search returned ${results.length} results`);
        }

        res.json({
            results,
            query,
            count: results.length,
            searchMethod,
            took_ms: Date.now() - startTime
        });

    } catch (error) {
        console.error('Events vibe search error:', error);
        res.status(500).json({ error: 'Failed to search events' });
    }
});

// ============================================
// REDDIT/HIDDEN EVENTS TEXT SEARCH  
// (No vector index needed - uses text search)
// ============================================

let redditCollection;

/**
 * POST /api/reddit/vibe-search
 * Text search for reddit/hidden events posts (no vector index required)
 */
app.post('/api/reddit/vibe-search', async (req, res) => {
    const startTime = Date.now();

    try {
        // Initialize reddit collection if not done
        if (!redditCollection) {
            redditCollection = db.collection('hidden_events');
        }

        const { query, limit = 20, filters = {} } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Use text search (no vector index needed)
        console.log('[Reddit] Text search for:', query);
        const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        const regexPattern = searchTerms.length > 0 ? searchTerms.join('|') : query;

        const matchQuery = {
            $or: [
                { title: { $regex: regexPattern, $options: 'i' } },
                { text: { $regex: regexPattern, $options: 'i' } },
                { context: { $regex: regexPattern, $options: 'i' } },
                { categories: { $elemMatch: { $regex: regexPattern, $options: 'i' } } }
            ]
        };

        if (filters.hiddenGemsOnly) matchQuery.isHiddenGem = true;
        if (filters.subreddit) matchQuery.subreddit = filters.subreddit;
        if (filters.minUpvotes) matchQuery.ups = { $gte: filters.minUpvotes };

        const results = await redditCollection
            .find(matchQuery)
            .sort({ ups: -1, relevanceScore: -1 })
            .limit(limit)
            .project({ embedding: 0 })
            .toArray();

        console.log(`[Reddit] Found ${results.length} results for "${query}"`);

        res.json({
            results,
            query,
            count: results.length,
            took_ms: Date.now() - startTime
        });

    } catch (error) {
        console.error('Reddit vibe search error:', error);
        res.status(500).json({ error: 'Failed to search reddit posts' });
    }
});

/**
 * GET /api/reddit/hidden-gems
 * Get highly-upvoted hidden gem recommendations
 */
app.get('/api/reddit/hidden-gems', async (req, res) => {
    try {
        if (!redditCollection) {
            redditCollection = db.collection('hidden_events');
        }

        const { limit = 10 } = req.query;

        const gems = await redditCollection
            .find({ isHiddenGem: true })
            .sort({ ups: -1, relevanceScore: -1 })
            .limit(parseInt(limit))
            .project({ embedding: 0 })
            .toArray();

        res.json({
            results: gems,
            count: gems.length
        });

    } catch (error) {
        console.error('Hidden gems error:', error);
        res.status(500).json({ error: 'Failed to fetch hidden gems' });
    }
});

// ============================================
// UNIFIED SEARCH (All collections)
// ============================================

/**
 * POST /api/search/unified
 * Search across places, events, and reddit simultaneously
 */
app.post('/api/search/unified', async (req, res) => {
    const startTime = Date.now();

    try {
        const { query, limit = 10 } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Initialize reddit collection
        if (!redditCollection) {
            redditCollection = db.collection('hidden_events');
        }

        const queryEmbedding = await getQueryEmbedding(query);

        // Search all four collections in parallel
        const [places, events, landmarks, reddit] = await Promise.all([
            // Places search
            queryEmbedding
                ? placesCollection.aggregate([
                    { $vectorSearch: { index: 'vibe_index', path: 'embedding', queryVector: queryEmbedding, numCandidates: 50, limit: limit } },
                    { $addFields: { score: { $meta: 'vectorSearchScore' }, type: 'place' } },
                    { $project: { embedding: 0 } }
                ]).toArray()
                : placesCollection.find({ businessname: { $regex: query, $options: 'i' } }).limit(limit).project({ embedding: 0 }).toArray().then(r => r.map(p => ({ ...p, type: 'place' }))),

            // Events search
            queryEmbedding
                ? eventsCollection.aggregate([
                    { $vectorSearch: { index: 'events_vibe_index', path: 'embedding', queryVector: queryEmbedding, numCandidates: 50, limit: limit } },
                    { $addFields: { score: { $meta: 'vectorSearchScore' }, type: 'event' } },
                    { $project: { embedding: 0 } }
                ]).toArray()
                : eventsCollection.find({ title: { $regex: query, $options: 'i' } }).limit(limit).project({ embedding: 0 }).toArray().then(r => r.map(e => ({ ...e, type: 'event' }))),

            // Landmarks search
            queryEmbedding
                ? landmarksCollection.aggregate([
                    { $vectorSearch: { index: 'boston_landmarks', path: 'embedding', queryVector: queryEmbedding, numCandidates: 50, limit: limit } },
                    { $addFields: { score: { $meta: 'vectorSearchScore' }, type: 'landmark' } },
                    { $project: { embedding: 0 } }
                ]).toArray().catch(() => [])
                : landmarksCollection.find({ name: { $regex: query, $options: 'i' } }).limit(limit).project({ embedding: 0 }).toArray().then(r => r.map(l => ({ ...l, type: 'landmark' }))).catch(() => []),

            // Reddit search (always text search - no vector index)
            redditCollection.find({
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { text: { $regex: query, $options: 'i' } },
                    { context: { $regex: query, $options: 'i' } }
                ]
            }).sort({ ups: -1 }).limit(limit).project({ embedding: 0 }).toArray().then(r => r.map(p => ({ ...p, type: 'reddit' })))
        ]);

        res.json({
            query,
            places: { results: places, count: places.length },
            events: { results: events, count: events.length },
            landmarks: { results: landmarks, count: landmarks.length },
            reddit: { results: reddit, count: reddit.length },
            took_ms: Date.now() - startTime
        });

    } catch (error) {
        console.error('Unified search error:', error);
        res.status(500).json({ error: 'Failed to search' });
    }
});


// ============================================
// MTA PROXY
// ============================================
app.get('/api/mta/:line', async (req, res) => {
  try {
    const { line } = req.params;
    let apiUrl;

    switch (line.toLowerCase()) {
      case 'ace':
        apiUrl = process.env.VITE_MTA_API_ACE;
        break;
      case 'bdfm':
        apiUrl = process.env.VITE_MTA_API_BDFM;
        break;
      case 'g':
        apiUrl = process.env.VITE_MTA_API_G;
        break;
      case 'jz':
        apiUrl = process.env.VITE_MTA_API_JZ;
        break;
      case 'nqrw':
        apiUrl = process.env.VITE_MTA_API_NQRW;
        break;
      case '1234567':
      case 'irt':
        apiUrl = process.env.VITE_MTA_API_1234567;
        break;
      default:
        return res.status(400).json({ error: 'Invalid subway line' });
    }

    if (!apiUrl) {
      console.error(`MTA API URL not configured for line ${line}`);
      return res.status(500).json({ error: 'MTA API URL not configured' });
    }

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`MTA API Error: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    // Convert to JSON and handle Long (timestamp) serialization if necessary
    // Simple JSON.stringify handles Longs as strings or objects depending on configuration
    res.json(feed);
  } catch (error) {
    console.error('MTA Proxy Error:', error);
    res.status(500).json({ error: 'Failed to fetch MTA data' });
  }
});

// Start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`✓ Server running on http://localhost:${PORT}`);
    });
});
