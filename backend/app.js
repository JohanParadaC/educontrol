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
const cors = require('cors');

const { verificarEntorno } = require('./config/env');
const { montarFrontend } = require('./static');
const errorHandler = require('./middlewares/errorHandler');

const usuariosRoutes = require('./routes/usuarios.routes');
const authRoutes = require('./routes/auth.routes');
const cursosRoutes = require('./routes/cursos.routes');
const inscripcionesRoutes = require('./routes/inscripciones.routes');
const adminRoutes = require('./routes/admin.routes');

if (process.env.NODE_ENV !== 'test') verificarEntorno();

const app = express();

/* ===========================
 * 1) Middlewares globales
 * =========================== */
app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

/* ===========================
 * 2) Rutas de la API
 * =========================== */
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/inscripciones', inscripcionesRoutes);
app.use('/api/admin', adminRoutes);

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
  console.log('ℹ️  Sin build de frontend; solo se sirve la API. Ejecuta "npm run build" en frontend/.');
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
