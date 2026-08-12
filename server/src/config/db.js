const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[DB] Connection to ${uri} failed: ${error.message}`);
    
    // Fallback to in-memory server if local mongo is down
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] Falling back to mongodb-memory-server...`);
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const fallbackUri = mongoServer.getUri();
      
      const conn = await mongoose.connect(fallbackUri);
      console.log(`[DB] In-Memory MongoDB connected: ${conn.connection.host}`);
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
