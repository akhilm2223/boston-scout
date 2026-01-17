import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

console.log('Testing MongoDB connection...');
console.log('URI:', MONGODB_URI?.replace(/:[^:@]+@/, ':****@')); // Hide password

const client = new MongoClient(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

async function test() {
  try {
    console.log('\n⏳ Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db('boston_database');
    const collections = await db.listCollections().toArray();
    console.log('\n📊 Collections found:');
    
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`  - ${coll.name}: ${count} documents`);
    }
    
    await client.close();
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
      console.log('\n🔍 Diagnosis: Network/Firewall Issue');
      console.log('Possible causes:');
      console.log('  1. Your IP is not whitelisted in MongoDB Atlas');
      console.log('  2. Your firewall is blocking port 27017');
      console.log('  3. Your network/ISP is blocking MongoDB connections');
      console.log('\n💡 Solution: Add your IP to MongoDB Atlas Network Access');
      console.log('   → https://cloud.mongodb.com/ → Network Access → Add IP Address');
    } else if (error.message.includes('authentication failed')) {
      console.log('\n🔍 Diagnosis: Authentication Issue');
      console.log('  → Check your username and password in .env');
    }
    
    process.exit(1);
  }
}

test();
