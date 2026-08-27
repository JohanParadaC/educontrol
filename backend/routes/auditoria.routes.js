// routes/auditoria.routes.js
const { Router } = require('express');
const { check } = require('express-validator');
const validateFields = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth');
const { roleCheck } = require('../middlewares/roleCheck');
const { listarAuditoria } = require('../controllers/auditoria.controller');
const { ACCIONES } = require('../models/Auditoria');

const router = Router();

/**
 * GET /api/auditoria — el historial, solo para administración.
 *
 * Es la única ruta del recurso: el registro se escribe desde dentro, nunca
 * desde fuera. Y `roleCheck('admin')` basta porque aquí no hay propiedad que
 * comprobar: el historial no es de nadie en particular.
 */
router.get(
  '/',
  [
    validateJWT,
    roleCheck('admin'),
    // Una acción que no existe devolvería siempre lista vacía y parecería que
    // no ha pasado nada, en vez de decir que el filtro está mal escrito.
    check('accion', 'Acción desconocida').optional().isIn(ACCIONES),
    check('buscar', 'La búsqueda no puede pasar de 100 caracteres')
      .optional()
      .isLength({ max: 100 }),
    validateFields,
  ],
  listarAuditoria
);

module.exports = router;
