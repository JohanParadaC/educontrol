// jest.setup.js
jest.setTimeout(30000);

const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDB, disconnectDB, mongoose } = require('./config/db');

// Silenciar warnings ruidosos pero NO ocultar errores reales
const origError = console.error;
console.error = (...args) => {
  if (String(args[0] || '').includes('DeprecationWarning')) return;
  origError(...args);
};

// ⬅️ CLAVE: secret para JWT en entorno de test
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DB_NAME = process.env.DB_NAME || 'jest';

let mongod;

beforeAll(async () => {
  // Base de datos en memoria para aislar tests
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;

  await connectDB(uri);
});

afterEach(async () => {
  // Limpiar colecciones entre casos
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await disconnectDB();
  if (mongod) await mongod.stop();
});