// backend/app.js
// ---------------------------------------------------------------------------
// La aplicación Express, y nada más: middlewares, rutas, 404 y errores.
//
// No conecta a la base de datos, no siembra usuarios y no llama a listen(). Eso
// vive en server.js. La separación importa porque los ~28 ficheros de test que
// hacen `require('../app')` para Supertest arrastraban, de rebote, la lógica de
// sembrado del admin y el servido de estáticos.
// ---------------------------------------------------------------------------

require('dotenv').config();
const express = require('express');
const compression = require('compression');
const morgan = require('morgan');

const { verificarEntorno, saltosDeProxy } = require('./config/env');
const { montarFrontend } = require('./static');
const { montarDocumentacion } = require('./docs');
const errorHandler = require('./middlewares/errorHandler');
const { cabecerasSeguras, limiteGeneral } = require('./middlewares/seguridadHttp');

const usuariosRoutes = require('./routes/usuarios.routes');
const authRoutes = require('./routes/auth.routes');
const cursosRoutes = require('./routes/cursos.routes');
const inscripcionesRoutes = require('./routes/inscripciones.routes');
const adminRoutes = require('./routes/admin.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const healthRoutes = require('./routes/health.routes');

/**
 * Dónde vive cada router.
 *
 * Es una tabla y no seis `app.use` sueltos porque hace de única fuente de
 * verdad: el test que compara `docs/openapi.yaml` con la realidad recorre esta
 * misma lista, así que una ruta nueva sin documentar sale en rojo el mismo día.
 *
 * `antesDelLimite` marca lo que se monta ANTES del freno de peticiones.
 */
const RUTAS_API = [
  // Las sondas de salud las llama el orquestador cada pocos segundos y no
  // tiene credenciales que dar. Un 429 en la sonda de vida reiniciaría el
  // contenedor sin que pase nada malo, así que van fuera del límite.
  { base: '/api/health', router: healthRoutes, antesDelLimite: true },

  { base: '/api/usuarios', router: usuariosRoutes },
  { base: '/api/auth', router: authRoutes },
  { base: '/api/cursos', router: cursosRoutes },
  { base: '/api/inscripciones', router: inscripcionesRoutes },
  { base: '/api/auditoria', router: auditoriaRoutes },
  { base: '/api/admin', router: adminRoutes },
];

if (process.env.NODE_ENV !== 'test') verificarEntorno();

const app = express();

/* ===========================
 * 1) Middlewares globales
 * =========================== */
app.disable('x-powered-by');

// Cuántos proxies hay delante. Va ANTES de los limitadores porque de esto
// depende qué considera Express que es `req.ip`, y esa es la clave con la que
// cuentan.
//
// Sin configurarlo, detrás de un nginx o de un balanceador `req.ip` es la IP
// del PROXY para todas las peticiones: el freno general dejaría de ser por
// usuario y pasaría a ser para todos juntos —una denegación de servicio que se
// hace uno mismo—, y el del login degradaría de IP+correo a solo correo.
// Además, express-rate-limit detecta la cabecera `X-Forwarded-For` sin
// `trust proxy` puesto y protesta con ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
//
// Por defecto 0: en el compose la aplicación publica el puerto directamente y
// no hay nadie delante. Detrás de un proxy, TRUST_PROXY=1.
app.set('trust proxy', saltosDeProxy());

// Cabeceras de seguridad. Sin ellas no había X-Content-Type-Options, ni HSTS,
// ni CSP: la SPA se podía incrustar en un iframe ajeno.
app.use(cabecerasSeguras());

// Aquí iba `app.use(cors())`. No hacía ninguna falta: el backend sirve el
// propio frontend desde este mismo origen (static.js), así que no hay petición
// cruzada que permitir. Lo único que aportaba era abrir la API a cualquier
// origen que quisiera llamarla desde un navegador.

app.use(compression());

// Un log por petición. En test estorba más que ayuda: son cientos por fichero.
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use(express.json());

/* ===========================
 * 2) Rutas de la API
 * =========================== */
for (const r of RUTAS_API.filter(r => r.antesDelLimite)) app.use(r.base, r.router);

// Freno general de la API. El del login, mucho más estricto, se monta dentro
// de routes/auth.routes.js, junto a la ruta que protege.
app.use('/api', limiteGeneral());

for (const r of RUTAS_API.filter(r => !r.antesDelLimite)) app.use(r.base, r.router);

/* ===========================
 * 3) Documentación de la API (solo fuera de producción)
 * =========================== */
montarDocumentacion(app);

/* ===========================
 * 4) Frontend (SPA), si hay build
 * =========================== */
const hayBuildFrontend = montarFrontend(app);
if (!hayBuildFrontend && process.env.NODE_ENV !== 'test') {
  console.log(
    'ℹ️  Sin build de frontend; solo se sirve la API. Ejecuta "npm run build" en frontend/.'
  );
}

/* ===========================
 * 5) 404 (no encontrado)
 * =========================== */
app.use((req, res) => {
  res.status(404).json({ ok: false, msg: 'Recurso no encontrado' });
});

/* ===========================
 * 6) Manejo de errores
 * =========================== */
app.use(errorHandler);

module.exports = app;
module.exports.hayBuildFrontend = hayBuildFrontend;
module.exports.RUTAS_API = RUTAS_API;
