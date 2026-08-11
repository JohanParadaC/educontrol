// config/memoryDb.js
// ---------------------------------------------------------------------------
// Mongo efímero en memoria para levantar el proyecto sin instalar nada.
//
// Se usa como red de seguridad: si no hay MONGO_URI y tampoco hay un mongod
// escuchando en local, arrancamos uno en memoria en vez de morir. Los datos se
// pierden al parar el proceso, así que nunca se activa en producción.
// ---------------------------------------------------------------------------

let servidor = null;

/**
 * @returns {Promise<string|null>} URI del Mongo en memoria, o null si el paquete
 * no está instalado (es una devDependency).
 */
async function iniciarMongoEnMemoria() {
  if (process.env.NODE_ENV === 'production') return null;

  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    return null; // sin devDependencies instaladas no hay plan B
  }

  servidor = await MongoMemoryServer.create();
  return servidor.getUri();
}

async function detenerMongoEnMemoria() {
  if (servidor) {
    await servidor.stop();
    servidor = null;
  }
}

const usandoMongoEnMemoria = () => servidor !== null;

module.exports = { iniciarMongoEnMemoria, detenerMongoEnMemoria, usandoMongoEnMemoria };
