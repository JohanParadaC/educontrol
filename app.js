// app.js
require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB');

    // Importar rutas (modelo REST plural)
    const usuariosRoutes      = require('./routes/usuarios.routes');
    const cursosRoutes        = require('./routes/cursos.routes');
    const inscripcionesRoutes = require('./routes/inscripciones.routes');
    const adminRoutes         = require('./routes/admin.routes');

    // Montar rutas
    app.use('/usuarios',      usuariosRoutes);
    app.use('/cursos',        cursosRoutes);
    app.use('/inscripciones', inscripcionesRoutes);
    app.use('/admin',         adminRoutes);

    // Ruta de bienvenida
    app.get('/', (req, res) => {
      res.send('🚀 Bienvenido a educontrol-backend');
    });

    // Iniciar servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🟢 Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err));