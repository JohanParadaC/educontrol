// backend/app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');

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

/* ===========================
 * 4) 404 (no encontrado)
 * =========================== */
app.use((req, res) => {
  res.status(404).json({ ok: false, msg: 'Recurso no encontrado' });
});

/* ===========================
 * 5) Manejo de errores
 * =========================== */
app.use(errorHandler);

/* =========================================================
 * 6) 🌱 Seed de ADMIN (ajustado a tu schema con tilde)
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
  } catch (err) {
    console.error('❌ Error creando admin:', err);
  }
}

/* ===========================
 * 7) Inicio del servidor
 *    - En test NO levantamos ni nos conectamos
 * =========================== */
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await connectDB();        // Conecta a MongoDB
      await ensureAdminSeed();  // 🌱 Crea admin si no existe (idempotente)

      const PORT = process.env.PORT || 3000; // DO inyecta PORT automáticamente
      app.listen(PORT, () => {
        console.log(`🟢 Servidor corriendo en http://localhost:${PORT}`);
      });
    } catch (err) {
      console.error('❌ Error al conectar a MongoDB:', err);
      process.exit(1);
    }
  })();
}

// ✅ Exportamos app para SuperTest/Jest
module.exports = app;