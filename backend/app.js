// backend/app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { connectDB } = require('./config/db');
const { verificarEntorno } = require('./config/env');

if (process.env.NODE_ENV !== 'test') verificarEntorno();

const usuariosRoutes = require('./routes/usuarios.routes');
const authRoutes = require('./routes/auth.routes');
const cursosRoutes = require('./routes/cursos.routes');
const inscripcionesRoutes = require('./routes/inscripciones.routes');
const adminRoutes = require('./routes/admin.routes');

const errorHandler = require('./middlewares/errorHandler');

const app = express();

/* ===========================
 * 1) Middlewares globales
 * =========================== */
app.disable('x-powered-by'); // opcional: pequeña mejora de seguridad
app.use(cors());
app.use(express.json());

/* ===========================
 * 2) Rutas de la API
 * =========================== */
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/inscripciones', inscripcionesRoutes);
app.use('/api/admin', adminRoutes); // ✅ una sola definición de /api/admin

/* ===========================
 * 3) Health-check
 * =========================== */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, status: 'up' });
});

/* ===========================================================
 * 4) Frontend (SPA)
 *    Si existe el build de Angular, lo servimos desde aquí. Un solo proceso y
 *    un solo origen: por eso `apiBase: '/api'` (relativo) es correcto y no hace
 *    falta CORS ni una URL absoluta del backend.
 *    Si no hay build, la API funciona igual y estas rutas no se montan.
 * =========================================================== */
const FRONTEND_DIST =
  process.env.FRONTEND_DIST ||
  path.join(__dirname, '..', 'frontend', 'dist', 'educontrol-frontend', 'browser');

const hayBuildFrontend = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

if (hayBuildFrontend) {
  // Los ficheros con hash en el nombre pueden cachearse fuerte; index.html no.
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));

  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next(); // deja pasar los 404 de API
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else if (process.env.NODE_ENV !== 'test') {
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

/* =========================================================
 * 7) 🌱 Seed de ADMIN (ajustado a tu schema con tilde)
 *    - Tu modelo se llama ./models/Usuario
 *    - Campos requeridos: nombre, correo, contraseña, rol
 *    - Hasheamos la contraseña con bcryptjs
 * ========================================================= */
const bcrypt = require('bcryptjs');
const Usuario = require('./models/Usuario'); // <- usa tu modelo real

async function ensureAdminSeed() {
  try {
    // Se leen de env; si no están, usamos valores por defecto
    const correo = process.env.ADMIN_EMAIL || 'admin@educontrol.com';
    const plainPassword = process.env.ADMIN_PASSWORD || 'Admin123*';

    // ⚠️ Una contraseña por defecto conocida en producción equivale a no tener
    // contraseña: el repo es público. Si no está configurada, no sembramos.
    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
      console.warn('⚠️  ADMIN_PASSWORD no configurada: se omite el seed del admin.');
      return;
    }

    // Si ya existe un usuario con ese correo, no hacemos nada
    const exists = await Usuario.findOne({ correo }).lean();
    if (exists) {
      console.log(`ℹ️  Admin ya existe: ${correo}`);
      return;
    }

    // Hash de contraseña (si tu modelo no lo hace en un pre-save)
    const hash = await bcrypt.hash(plainPassword, 10);

    // ⚠️  OJO: usamos exactamente los nombres de tu schema.
    // Usamos bracket-notation para el campo "contraseña" (con tilde).
    await Usuario.create({
      nombre: 'Admin',
      correo,
      ['contraseña']: hash,
      rol: 'admin',
      // 👉 Si tu schema exige más campos (p.ej. "estado" o "activo"),
      // añádelos aquí. Ejemplo:
      // estado: true,
    });

    console.log(`✅ Admin creado: ${correo}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`   contraseña: ${plainPassword}`);
    }
  } catch (err) {
    console.error('❌ Error creando admin:', err);
  }
}

/* ===========================
 * 8) Inicio del servidor
 *    - En test NO levantamos ni nos conectamos
 * =========================== */
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await connectDB();        // Conecta a MongoDB
      await ensureAdminSeed();  // 🌱 Crea admin si no existe (idempotente)

      // Con Mongo en memoria la base arranca vacía en cada ejecución, así que
      // sembramos datos de ejemplo para que la app se pueda mirar de verdad.
      const { usandoMongoEnMemoria } = require('./config/memoryDb');
      if (process.env.SEED_DEMO === '1' || usandoMongoEnMemoria()) {
        await require('./scripts/seedDemo')();
      }

      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`🟢 Servidor corriendo en http://localhost:${PORT}`);
        if (hayBuildFrontend) console.log('🖥️  Frontend servido en la misma URL');
      });
    } catch (err) {
      console.error('❌ Error al conectar a MongoDB:', err);
      process.exit(1);
    }
  })();
}

// ✅ Exportamos app para SuperTest/Jest
module.exports = app;