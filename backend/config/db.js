// config/db.js
const mongoose = require('mongoose');

let connecting = null;

function resolveUri(paramUri) {
  const envUri =
    process.env.MONGO_CNN ||       // <— ahora sí lee MONGO_CNN (DO)
    process.env.MONGO_URI ||
    process.env.MONGODB_URI;

  if (paramUri) return paramUri;
  if (envUri) return envUri;

  // Solo en desarrollo permitimos localhost.
  if (process.env.NODE_ENV !== 'production') {
    return 'mongodb://127.0.0.1:27017/educontrol';
  }

  throw new Error('No hay URI de Mongo definida (MONGO_CNN/MONGO_URI/MONGODB_URI).');
}

async function connectDB(uri) {
  const finalUri = resolveUri(uri);

  // Evita reconectar si ya está conectado
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;

  // (opcional) log para verificar que NO sea 127.0.0.1 en DO
  try {
    const { hostname } = new URL(finalUri);
    console.log('🔎 Mongo host ->', hostname);
  } catch {}

  connecting = mongoose.connect(finalUri, {
    dbName: process.env.DB_NAME || 'educontrol',
    serverSelectionTimeoutMS: 10000,
  });

  await connecting;
  console.log('✅ MongoDB conectado');
  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connecting = null;
}

module.exports = { connectDB, disconnectDB, mongoose };