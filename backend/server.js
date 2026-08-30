// backend/server.js
// ---------------------------------------------------------------------------
// Arranque y apagado del proceso: conectar, migrar, sembrar, escuchar — y
// cerrar en orden cuando lo pidan.
//
// Separado de app.js siguiendo el patrón habitual de Express, precisamente
// porque los tests importan `app` y no deben provocar conexiones ni escuchas.
// Por lo mismo, este fichero solo arranca solo cuando se ejecuta directamente
// (`node server.js`): al importarlo desde un test, se puede llamar a
// `arrancar()` y a `apagar()` a mano.
// ---------------------------------------------------------------------------

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { ensureAdminSeed } = require('./config/seed');
const { migrar } = require('./config/migraciones');
const { usandoMongoEnMemoria } = require('./config/memoryDb');
const { marcarNoDisponible } = require('./controllers/health.controller');

/** El servidor HTTP, mientras esté escuchando. */
let servidor = null;
/** Un segundo SIGTERM no debe empezar otro apagado por encima del primero. */
let apagando = false;

/**
 * Tiempo entre decir "ya no estoy disponible" y dejar de escuchar.
 *
 * No es una pausa decorativa: un balanceador tarda un poco en enterarse de que
 * la sonda de disponibilidad devuelve 503, y durante ese rato sigue mandando
 * peticiones. Cerrar el socket inmediatamente las convierte en errores de
 * conexión para el cliente. Por defecto 0 —en local y en los tests estorba—;
 * en Kubernetes se pone en 5000 y ahí sí se nota.
 */
const ESPERA_ANTES_DE_CERRAR = Number(process.env.SHUTDOWN_DELAY_MS ?? 0);

/**
 * Cuánto se espera a las peticiones en curso antes de cortar por lo sano.
 * Sin tope, una petición colgada dejaría el proceso sin morir nunca y el
 * orquestador acabaría matándolo a lo bruto (SIGKILL), que es lo que se
 * intenta evitar.
 *
 * Se lee al apagar y no al cargar el módulo: así un test puede ajustarlo sin
 * tener que reimportar el fichero entero.
 */
const limiteApagado = () => Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000);

const dormir = ms => new Promise(r => setTimeout(r, ms));

/**
 * Levanta el proceso.
 *
 * `aplicacion` se puede sustituir, y no es un adorno para los tests: el
 * fallback de la SPA se monta al cargar app.js, así que cualquier ruta añadida
 * después queda tapada por él. Para probar el apagado hace falta una petición
 * lenta, y la única forma limpia de tenerla es escuchar sobre otra aplicación.
 */
async function arrancar({ puerto = process.env.PORT || 3000, aplicacion = app } = {}) {
  await connectDB();
  await migrar();
  await ensureAdminSeed();

  // Con Mongo en memoria la base arranca vacía en cada ejecución, así que
  // sembramos datos de ejemplo para que la app se pueda mirar de verdad.
  if (process.env.SEED_DEMO === '1' || usandoMongoEnMemoria()) {
    await require('./scripts/seedDemo')();
  }

  servidor = await escuchar(aplicacion, puerto);

  const puertoReal = servidor.address().port;
  console.log(`🟢 Servidor corriendo en http://localhost:${puertoReal}`);
  if (aplicacion.hayBuildFrontend) console.log('🖥️  Frontend servido en la misma URL');

  return servidor;
}

/**
 * Traduce los fallos de `listen()` a algo que se pueda leer.
 *
 * Sin esto, el puerto ocupado —el caso más común de todos— salía como
 * `TypeError: Cannot read properties of null (reading 'port')`, que no nombra
 * ni el puerto ni el problema. Es exactamente el síntoma lejos de la causa que
 * `config/env.js` existe para evitar, y aquí estaba entrando por otra puerta.
 */
function errorDeEscucha(err, puerto) {
  if (err?.code === 'EADDRINUSE') {
    return Object.assign(
      new Error(
        `El puerto ${puerto} ya está en uso. Cierra lo que lo esté ocupando ` +
          `—otra instancia, o el contenedor con \`docker compose down\`— o arranca ` +
          `con otro: PORT=3001 npm start.`
      ),
      { code: err.code }
    );
  }
  if (err?.code === 'EACCES') {
    return Object.assign(
      new Error(
        `Sin permiso para escuchar en el puerto ${puerto}. Prueba con uno por encima de 1024.`
      ),
      { code: err.code }
    );
  }
  return err;
}

/**
 * Levanta el servidor y espera a que esté escuchando DE VERDAD.
 *
 * En Windows, `listen()` sobre un puerto ocupado llama igualmente al callback
 * de `listening` y deja `address()` en `null`; el `'error'` llega después. Por
 * eso no basta con resolver en el callback: hay que comprobar que hay
 * dirección, y enganchar `'error'` antes de que nadie lo escuche —un `'error'`
 * sin manejador en un EventEmitter tumba el proceso—.
 */
function escuchar(aplicacion, puerto) {
  return new Promise((resolver, rechazar) => {
    const s = aplicacion.listen(puerto);
    s.once('error', err => rechazar(errorDeEscucha(err, puerto)));
    s.once('listening', () => {
      if (s.address()) resolver(s);
      // Sin dirección no está escuchando: el 'error' viene de camino y es el
      // que sabe por qué.
    });
  });
}

/**
 * Apagado ordenado. Nunca lanza: si algo falla al cerrar, se avisa y se sigue
 * bajando — quedarse a medias es peor.
 *
 * El orden importa y es este:
 *   1. dejar de decir que estamos disponibles (la sonda pasa a 503),
 *   2. esperar a que el balanceador se entere,
 *   3. dejar de aceptar conexiones y esperar a las peticiones EN CURSO,
 *   4. soltar la base de datos.
 *
 * `closeIdleConnections` no es un detalle: con keep-alive, `close()` espera a
 * que se cierren también los sockets ociosos, y un navegador abierto los
 * mantiene abiertos minutos. Sin esa llamada, el apagado ordenado se convierte
 * siempre en el corte por tiempo.
 */
async function apagar(senal = 'apagado') {
  if (apagando) return;
  apagando = true;

  console.log(`\n🛑 ${senal} recibida: cerrando ordenadamente…`);
  marcarNoDisponible();

  if (ESPERA_ANTES_DE_CERRAR > 0) await dormir(ESPERA_ANTES_DE_CERRAR);

  if (servidor) {
    await new Promise(resolve => {
      let hecho = false;
      const terminar = () => {
        if (hecho) return;
        hecho = true;
        clearInterval(repaso);
        clearTimeout(corte);
        resolve();
      };

      // Las conexiones ociosas no tienen nada que terminar, así que fuera. Se
      // repasa cada poco y no una sola vez: la que ahora está sirviendo estará
      // ociosa dentro de un momento y, con keep-alive, nadie la cierra. Sin
      // este repaso, el apagado "ordenado" acaba SIEMPRE en el corte por
      // tiempo, que es justo lo contrario de lo que se busca.
      const repaso = setInterval(() => servidor?.closeIdleConnections?.(), 200);
      repaso.unref?.();

      const corte = setTimeout(() => {
        console.warn('⚠️  Peticiones en curso demasiado lentas: se cierran a la fuerza.');
        servidor?.closeAllConnections?.();
        terminar();
      }, limiteApagado());
      corte.unref?.();

      servidor.close(err => {
        if (err) console.error('⚠️  Error cerrando el servidor HTTP:', err.message);
        terminar();
      });
      servidor.closeIdleConnections?.();
    });
    servidor = null;
  }

  try {
    await disconnectDB();
  } catch (err) {
    console.error('⚠️  Error desconectando de Mongo:', err.message);
  }

  console.log('👋 Cerrado.');
}

/** Engancha SIGTERM y SIGINT. Se llama solo al ejecutar el fichero. */
function escucharSenales() {
  for (const senal of ['SIGTERM', 'SIGINT']) {
    process.on(senal, () => {
      apagar(senal).finally(() => process.exit(0));
    });
  }
}

if (require.main === module) {
  escucharSenales();
  arrancar().catch(err => {
    // Los fallos de configuración —puerto ocupado, permisos, entorno mal
    // puesto— ya vienen con un mensaje que dice qué hacer: la traza solo
    // esconde ese mensaje entre líneas de node_modules. El resto sí se
    // imprime entero, porque ahí la traza es lo único que hay.
    if (err?.code) console.error(`❌ Error al arrancar: ${err.message}`);
    else console.error('❌ Error al arrancar:', err);
    process.exit(1);
  });
}

module.exports = { arrancar, apagar, escucharSenales };
