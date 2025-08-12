// backend/app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 🚀 Conexión a BD (asegúrate de que config/db exporte { connectDB } y no se auto-conecte)
const { connectDB } = require('./config/db');

const usuariosRoutes = require('./routes/usuarios.routes');
const authRoutes = require('./routes/auth.routes');
const cursosRoutes = require('./routes/cursos.routes');
const inscripcionesRoutes = require('./routes/inscripciones.routes');
const adminRoutes = require('./routes/admin.routes');

const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ---------- 1) Middlewares globales ----------
app.disable('x-powered-by'); // opcional: pequeña mejora de seguridad
app.use(cors());
app.use(express.json());

// ---------- 2) Rutas ----------
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/inscripciones', inscripcionesRoutes);
app.use('/api/admin', adminRoutes); // ✅ una sola definición

// ---------- 3) Health-check ----------
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, status: 'up' });
});

// ---------- 4) 404 ----------
app.use((req, res) => {
  res.status(404).json({ ok: false, msg: 'Recurso no encontrado' });
});

// ---------- 5) Manejo de errores ----------
app.use(errorHandler);

// ---------- EXTRA: utilidades para seed de admin ----------
/**
 * Carga "tolerante" del modelo de Usuario, probando varias rutas comunes.
 * Ajusta si tu modelo tiene otro nombre/ruta.
 */
function loadUserModel() {
  const candidates = [
    './models/Usuario',
    './models/usuario',
    './models/User',
    './models/user',
    './models/usuario.model',
    './models/user.model',
    './models/Usuario.model',
  ];

  for (const p of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const Model = require(p);
      if (Model) {
        console.log(`👤 Modelo de usuario cargado desde: ${p}`);
        return Model;
      }
    } catch (e) {
      // intentar siguiente
    }
  }
  console.warn('⚠️  No se pudo cargar el modelo de Usuario con las rutas conocidas.');
  return null;
}

/**
 * Crea un usuario admin si no existe.
 * Usa email y contraseña desde variables de entorno (con defaults).
 * Asigna role: 'admin'.
 */
async function ensureAdminSeed() {
  const User = loadUserModel();
  if (!User) {
    console.warn('⚠️  Seed de admin omitido: no se pudo cargar el modelo de Usuario.');
    return;
  }

  // Lee credenciales de admin desde env
  const email = process.env.ADMIN_EMAIL || 'admin@educontrol.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin123*';

  try {
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      console.log(`ℹ️  Admin ya existe: ${email}`);
      return;
    }

    // Nota: asumimos que el modelo maneja el hash via middleware (pre('save')).
    // Si no fuera así en tu proyecto, puedes hashear aquí con bcryptjs.
    const admin = new User({
      name: 'Admin',
      email,
      password,
      role: 'admin',
      active: true,
    });

    await admin.save();
    console.log(`✅ Admin creado: ${email}`);
  } catch (err) {
    console.error('❌ Error creando admin:', err);
  }
}

// ---------- 6) Start del servidor ----------
// En test (NODE_ENV === 'test') NO conectamos ni levantamos servidor.
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await connectDB(); // conecta a la DB (producción/desarrollo)

      // 🌱 Semilla de administrador (idempotente)
      await ensureAdminSeed();

      const PORT = process.env.PORT || 3000;
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