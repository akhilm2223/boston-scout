import { MongoClient } from "mongodb";
import { config } from "dotenv";

config();

const MONGODB_URI = process.env.MONGODB_URI || "";

async function analyzeData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log("✓ Connected\n");

    // Check boston_database
    console.log("=== BOSTON_DATABASE ===");
    const bostonDb = client.db("boston_database");
    const bostonColls = await bostonDb.listCollections().toArray();
    
    for (const coll of bostonColls) {
      const collection = bostonDb.collection(coll.name);
      const count = await collection.countDocuments();
      console.log(`\n${coll.name}: ${count} documents`);
      
      if (count > 0) {
        const sample = await collection.findOne();
        console.log(`Keys: ${Object.keys(sample || {}).join(", ")}`);
        console.log(`Sample:`, JSON.stringify(sample, null, 2).substring(0, 500));
      }
    }

    // Check user_db
    console.log("\n\n=== USER_DB ===");
    const userDb = client.db("user_db");
    const userColls = await userDb.listCollections().toArray();
    
    for (const coll of userColls) {
      const collection = userDb.collection(coll.name);
      const count = await collection.countDocuments();
      console.log(`\n${coll.name}: ${count} documents`);
      
      if (count > 0) {
        const sample = await collection.findOne();
        console.log(`Keys: ${Object.keys(sample || {}).join(", ")}`);
        console.log(`Sample:`, JSON.stringify(sample, null, 2).substring(0, 300));
      }
    }

    // Analyze BOSTON_ITINERARY posts
    console.log("\n\n=== BOSTON_ITINERARY POSTS BREAKDOWN ===");
    const itineraryDb = client.db("BOSTON_ITINERARY");
    const posts = itineraryDb.collection("posts");
    
    const total = await posts.countDocuments();
    const mlkEvents = await posts.countDocuments({ isMLKEvent: true });
    const parentFriendly = await posts.countDocuments({ isParentFriendly: true });
    const studentFriendly = await posts.countDocuments({ isStudentFriendly: true });
    const wpiLogistics = await posts.countDocuments({ isWPILogistics: true });
    
    console.log(`Total posts: ${total}`);
    console.log(`MLK Events: ${mlkEvents}`);
    console.log(`Parent Friendly: ${parentFriendly}`);
    console.log(`Student Friendly: ${studentFriendly}`);
    console.log(`WPI Logistics: ${wpiLogistics}`);
    
    // Sample titles
    console.log("\nSample post titles:");
    const samples = await posts.find().limit(10).toArray();
    samples.forEach((p: any, i: number) => {
      console.log(`${i + 1}. [${p.subreddit}] ${p.title.substring(0, 80)}`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

analyzeData();
