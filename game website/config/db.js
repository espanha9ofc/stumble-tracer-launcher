const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 0);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Wait 5s before timing out
      connectTimeoutMS: 10000,
      family: 4 // Force IPv4 to avoid common DNS resolution issues with Atlas
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB Connection Error: ${err.message}`);
    console.warn('⚠️ Server will continue running in OFFLINE mode (Some features will be disabled).');
    return false;
  }
};

module.exports = connectDB;
