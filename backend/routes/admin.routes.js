// routes/admin.routes.js
const express  = require('express');
const mongoose = require('mongoose');
const { seedAdmin } = require('../controllers/admin.controller');

const router = express.Router();

/**
 * DELETE /api/admin/purge
 * Herramienta de desarrollo: vacía toda la base de datos.
 * ⚠️ Úsalo con cuidado (idealmente protegido/solo para entornos no productivos).
 */
router.delete('/purge', async (_req, res) => {
  try {
    await mongoose.connection.dropDatabase();
    return res.status(200).send('✅ Base de datos vaciada por completo');
  } catch (err) {
    console.error('Error al purgar DB:', err);
    return res.status(500).send(`❌ Error borrando DB: ${err.message}`);
  }
});

/**
 * POST /api/admin/seed-admin
 * Crea/asegura un usuario admin (útil para tests/arranque).
 */
router.post('/seed-admin', seedAdmin);

/**
 * GET /api/admin/boom  (SOLO EN TEST)
 * Endpoint de prueba que fuerza un error para cubrir el errorHandler (500).
 * - No requiere auth.
 * - Disponible únicamente cuando NODE_ENV === 'test'.
 */
if (process.env.NODE_ENV === 'test') {
  router.get('/boom', (_req, _res, next) => {
    const err = new Error('boom');
    // opcional: marca que no se exponga el mensaje en prod si tu handler lo respeta
    err.expose = false;
    next(err); // delega al middleware global errorHandler
  });
}

module.exports = router;