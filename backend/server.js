// backend/server.js
// ---------------------------------------------------------------------------
// Arranque del proceso: conectar a la base, sembrar y escuchar.
//
// Separado de app.js siguiendo el patrón habitual de Express, precisamente
// porque los tests importan `app` y no deben provocar conexiones ni escuchas.
// ---------------------------------------------------------------------------

const app = require('./app');
const { connectDB } = require('./config/db');
const { ensureAdminSeed } = require('./config/seed');
const { migrar } = require('./config/migraciones');
const { usandoMongoEnMemoria } = require('./config/memoryDb');

async function arrancar() {
  try {
    await connectDB();
    await migrar();
    await ensureAdminSeed();

    // Con Mongo en memoria la base arranca vacía en cada ejecución, así que
    // sembramos datos de ejemplo para que la app se pueda mirar de verdad.
    if (process.env.SEED_DEMO === '1' || usandoMongoEnMemoria()) {
      await require('./scripts/seedDemo')();
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🟢 Servidor corriendo en http://localhost:${PORT}`);
      if (app.hayBuildFrontend) console.log('🖥️  Frontend servido en la misma URL');
    });
  } catch (err) {
    console.error('❌ Error al arrancar:', err);
    process.exit(1);
  }
}

arrancar();
