// server/db/connection.js
// Centralized MongoDB connection.
// We isolate this in its own module so:
//   1. The connection string lives in one place (loaded from .env).
//   2. server/index.js stays focused on HTTP setup.
//   3. If we ever swap to a different DB or pool config, we change one file.

const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set. Check your .env file.');
  }

  try {
    await mongoose.connect(uri);
    console.log(`[db] Connected to MongoDB → ${mongoose.connection.name}`);
  } catch (err) {
    // If the DB is unreachable, the app can't function — fail loud and exit.
    console.error('[db] Connection failed:', err.message);
    process.exit(1);
  }

  // Surface disconnects in the logs so we notice them during demos.
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });
}

module.exports = connectDB;
