import { MongoClient } from "mongodb";
import { config } from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || "";
const BOSTON_DB_NAME = "boston_database";
const BOSTON_COLLECTION = "hidden_events";

async function checkCount() {
    if (!MONGODB_URI) {
        console.error("MONGODB_URI not set");
        process.exit(1);
    }
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const col = client.db(BOSTON_DB_NAME).collection(BOSTON_COLLECTION);
        const count = await col.countDocuments();
        console.log(`\n📊 Count in ${BOSTON_DB_NAME}.${BOSTON_COLLECTION}: ${count} documents`);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkCount();
