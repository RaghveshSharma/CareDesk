import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer = null;

export const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;

    // Production guardrail: persistent database is strictly required
    if (process.env.NODE_ENV === 'production') {
      if (!mongoUri || mongoUri.trim() === '' || mongoUri.trim().toLowerCase() === 'memory') {
        throw new Error(
          'FATAL CONFIGURATION ERROR: MONGODB_URI is strictly required in production mode. In-memory database fallback is disallowed in production.'
        );
      }
    }

    if (!mongoUri || mongoUri.trim() === '' || mongoUri.trim().toLowerCase() === 'memory') {
      console.log('ℹ️  Development/Demo Mode: Initializing in-memory MongoDB instance...');
      mongoMemoryServer = await MongoMemoryServer.create();
      mongoUri = mongoMemoryServer.getUri();
      console.log('✅ In-memory MongoDB server ready.');
    } else {
      console.log('🔄 Connecting to configured MongoDB instance...');
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`✅ MongoDB Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
  } catch (err) {
    console.error('Error closing DB:', err.message);
  }
};
