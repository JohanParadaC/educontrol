require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const dbConnection = require('./config/db');

const usuariosRoutes      = require('./routes/usuarios.routes');
const authRoutes          = require('./routes/auth.routes');
const cursosRoutes        = require('./routes/cursos.routes');
const inscripcionesRoutes = require('./routes/inscripciones.routes');
const adminRoutes         = require('./routes/admin.routes');

const app = express();

// 1) Middlewares globales
app.use(cors());
app.use(express.json());

// 2) Rutas
app.use('/api/usuarios',      usuariosRoutes);
app.use('/api/auth',          authRoutes);
app.use('/api/cursos',        cursosRoutes);
app.use('/api/inscripciones', inscripcionesRoutes);
app.use('/api/admin',         adminRoutes);

// 3) Health‑check
app.get('/', (req, res) => {
  res.json({ ok: true, msg: '🚀 API EduControl funcionando' });
});

// 4) Catch‑all 404
app.use('*', (req, res) => {
  res.status(404).json({ ok: false, msg: 'Recurso no encontrado' });
});

// 5) **Aquí coloca el middleware de manejo de errores**:
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// 6) **Al final, lee el PORT y arranca el listener**:
const PORT = process.env.PORT || 3000;
dbConnection();            // Conecta a MongoDB (si falla, sale del proceso)
app.listen(PORT, () => {
  console.log(`🟢 Servidor corriendo en http://localhost:${PORT}`);
});