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

const { verificarEntorno } = require('./config/env');
const { montarFrontend } = require('./static');
const errorHandler = require('./middlewares/errorHandler');
const { cabecerasSeguras, limiteGeneral } = require('./middlewares/seguridadHttp');

const usuariosRoutes = require('./routes/usuarios.routes');
const authRoutes = require('./routes/auth.routes');
const cursosRoutes = require('./routes/cursos.routes');
const inscripcionesRoutes = require('./routes/inscripciones.routes');
const adminRoutes = require('./routes/admin.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');

if (process.env.NODE_ENV !== 'test') verificarEntorno();

const app = express();

/* ===========================
 * 1) Middlewares globales
 * =========================== */
app.disable('x-powered-by');

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

// Freno general de la API. El del login, mucho más estricto, se monta dentro
// de routes/auth.routes.js, junto a la ruta que protege.
app.use('/api', limiteGeneral());

/* ===========================
 * 2) Rutas de la API
 * =========================== */
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/inscripciones', inscripcionesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auditoria', auditoriaRoutes);

/* ===========================
 * 3) Health-check
 * =========================== */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, status: 'up' });
});

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
