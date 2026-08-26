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

function conectar(uri, timeoutMs) {
  return mongoose.connect(uri, {
    dbName: process.env.DB_NAME || 'educontrol',
    serverSelectionTimeoutMS: timeoutMs,
  });
}

async function connectDB(uri) {
  const finalUri = resolveUri(uri);
  const uriExplicita = Boolean(uri || process.env.MONGO_CNN || process.env.MONGO_URI || process.env.MONGODB_URI);

  // Evita reconectar si ya está conectado
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;

  try {
    const { hostname } = new URL(finalUri);
    console.log('🔎 Mongo host ->', hostname);
  } catch {
    // La URI no es parseable como URL: seguimos sin registrar el host.
  }

  // Si la URI es la de por defecto (localhost) esperamos poco: o hay un mongod
  // escuchando o no lo hay, y no tiene sentido bloquear el arranque 10 s.
  try {
    connecting = conectar(finalUri, uriExplicita ? 10000 : 3000);
    await connecting;
  } catch (err) {
    connecting = null;

    // Sin URI configurada y sin mongod local: levantamos uno en memoria para
    // que el proyecto se pueda arrancar sin instalar MongoDB.
    if (uriExplicita || process.env.NODE_ENV === 'production') throw err;

    const { iniciarMongoEnMemoria } = require('./memoryDb');
    const uriMemoria = await iniciarMongoEnMemoria();
    if (!uriMemoria) throw err;

    console.warn('⚠️  No hay MongoDB local ni MONGO_URI: usando Mongo en memoria (datos efímeros).');
    connecting = conectar(uriMemoria, 10000);
    await connecting;
  }

  console.log('✅ MongoDB conectado');
  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connecting = null;
  await require('./memoryDb').detenerMongoEnMemoria();
}

// resolveUri se exporta para poder probarla sola: es la decisión importante
// (a qué Mongo apuntamos) y es lógica pura, sin red de por medio.
module.exports = { connectDB, disconnectDB, resolveUri, mongoose };