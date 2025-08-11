// config/db.js
const mongoose = require('mongoose');

let connecting = null;

async function connectDB(uri) {
  const finalUri =
    uri ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/educontrol';

  // Evita reconectar si ya está conectado
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;

  connecting = mongoose.connect(finalUri, {
    dbName: process.env.DB_NAME || 'educontrol',
    serverSelectionTimeoutMS: 10000,
  });

  await connecting;
  console.log('MongoDB conectado');
  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connecting = null;
}

module.exports = { connectDB, disconnectDB, mongoose };
