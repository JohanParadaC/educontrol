// routes/admin.routes.js
const express = require('express');
const mongoose = require('mongoose');
const { seedAdmin } = require('../controllers/admin.controller');
const { validateJWT } = require('../middlewares/auth');
const { roleCheck } = require('../middlewares/roleCheck');

const router = express.Router();

/**
 * Puerta de entorno para herramientas destructivas / de bootstrap.
 *
 * Es "fail-closed" a propósito: si NODE_ENV no está definido asumimos
 * producción y devolvemos 404. Un 404 (y no un 403) evita confirmar al
 * atacante que la ruta existe en el entorno productivo.
 */
const soloEntornosNoProductivos = (_req, res, next) => {
  const env = process.env.NODE_ENV || 'production';
  if (env !== 'test' && env !== 'development') {
    return res.status(404).json({ ok: false, msg: 'Recurso no encontrado' });
  }
  next();
};

/**
 * DELETE /api/admin/purge
 * Herramienta de desarrollo: vacía toda la base de datos.
 *
 * Protección en tres capas:
 *  1) solo existe fuera de producción,
 *  2) exige JWT válido,
 *  3) exige rol admin.
 */
router.delete(
  '/purge',
  [soloEntornosNoProductivos, validateJWT, roleCheck('admin')],
  async (_req, res) => {
    try {
      await mongoose.connection.dropDatabase();
      return res.status(200).json({ ok: true, msg: 'Base de datos vaciada por completo' });
    } catch (err) {
      console.error('Error al purgar DB:', err);
      return res.status(500).json({ ok: false, msg: 'Error borrando la base de datos' });
    }
  }
);

/**
 * POST /api/admin/seed-admin
 * Crea el usuario admin inicial (bootstrap para desarrollo y tests).
 *
 * No exige JWT —sería un problema del huevo y la gallina: sirve justamente para
 * crear la primera cuenta administradora—, así que se apoya en dos garantías:
 *  1) solo existe fuera de producción (en producción el admin lo crea
 *     `ensureAdminSeed()` de app.js a partir de variables de entorno),
 *  2) el controlador nunca modifica un usuario que ya exista.
 */
router.post('/seed-admin', [soloEntornosNoProductivos], seedAdmin);

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
