// backend/app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// CAMBIO: importamos funciones explícitas desde config/db.
// Asegúrate de que `config/db.js` exporte { connectDB } y NO se auto-conecte al importar.
const { connectDB } = require('./config/db');

const usuariosRoutes = require('./routes/usuarios.routes');
const authRoutes = require('./routes/auth.routes');
const cursosRoutes = require('./routes/cursos.routes');
const inscripcionesRoutes = require('./routes/inscripciones.routes');
const adminRoutes = require('./routes/admin.routes');

const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ---------- 1) Middlewares globales ----------
app.disable('x-powered-by');            // opcional: pequeña mejora de seguridad
app.use(cors());
app.use(express.json());

// ---------- 2) Rutas ----------
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/inscripciones', inscripcionesRoutes);
// ✅ Evitar duplicados: dejamos una sola línea para /api/admin
app.use('/api/admin', adminRoutes);

// ---------- 3) Health-check (usado por tests) ----------
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, status: 'up' });
});

// ---------- 4) 404 ----------
app.use((req, res) => {
  res.status(404).json({ ok: false, msg: 'Recurso no encontrado' });
});

// ---------- 5) Manejo de errores ----------
app.use(errorHandler);

// ---------- 6) Start del servidor ----------
// CAMBIO CLAVE: en entorno de test (NODE_ENV === 'test') NO conectamos ni levantamos servidor.
// Los tests (Jest) manejarán la conexión a Mongo (p. ej., con mongodb-memory-server) en jest.setup.js.
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await connectDB(); // conecta a la DB (producción/desarrollo)
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