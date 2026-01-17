import { MongoClient } from "mongodb";
import { config } from "dotenv";

config();

const MONGODB_URI = process.env.MONGODB_URI || "";

async function checkDatabase() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set in .env");
    return;
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log("✓ Connected to MongoDB\n");

    // List all databases
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log("=== DATABASES ===");
    dbs.databases.forEach(db => {
      console.log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Check CRUX database
    console.log("\n=== CRUX DATABASE ===");
    const cruxDb = client.db("CRUX");
    const cruxCollections = await cruxDb.listCollections().toArray();
    console.log("Collections:");
    for (const coll of cruxCollections) {
      const collection = cruxDb.collection(coll.name);
      const count = await collection.countDocuments();
      console.log(`  - ${coll.name}: ${count} documents`);
      
      if (count > 0) {
        const sample = await collection.findOne();
        console.log(`    Sample keys: ${Object.keys(sample || {}).join(", ")}`);
      }
    }

    // Check BOSTON_ITINERARY database
    console.log("\n=== BOSTON_ITINERARY DATABASE ===");
    const bostonDb = client.db("BOSTON_ITINERARY");
    const bostonCollections = await bostonDb.listCollections().toArray();
    
    if (bostonCollections.length === 0) {
      console.log("Database doesn't exist yet or has no collections");
    } else {
      console.log("Collections:");
      for (const coll of bostonCollections) {
        const collection = bostonDb.collection(coll.name);
        const count = await collection.countDocuments();
        console.log(`  - ${coll.name}: ${count} documents`);
        
        if (count > 0) {
          const sample = await collection.findOne();
          console.log(`    Sample keys: ${Object.keys(sample || {}).join(", ")}`);
        }
      }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
    console.log("\n✓ Connection closed");
  }
}

checkDatabase();
