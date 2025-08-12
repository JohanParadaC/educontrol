const { Router }      = require('express');
const { check }       = require('express-validator');
const validateFields  = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth');
const { roleCheck }   = require('../middlewares/roleCheck');
const {
  crearCurso,
  obtenerCursos,
  obtenerCursoPorId,
  actualizarCurso,
  borrarCurso
} = require('../controllers/cursos.controller');

const router = Router();

/**
 * Rutas:
 * - POST   /api/cursos        (profesor|admin) crea curso
 * - GET    /api/cursos        (auth) lista cursos
 * - GET    /api/cursos/:id    (auth) curso por id
 * - PUT    /api/cursos/:id    (profesor|admin) actualiza (incluye profesor opcional)
 * - DELETE /api/cursos/:id    (profesor|admin) borra
 */

// Crear curso (profesor o admin)
// CAMBIO: validamos opcionalmente que "profesor" sea ObjectId
router.post(
  '/',
  [
    validateJWT,
    roleCheck('profesor', 'admin'),
    check('nombre', 'El nombre es obligatorio').not().isEmpty(),
    check('profesor').optional().isMongoId(),
    validateFields
  ],
  crearCurso
);

// Listar cursos (cualquier usuario autenticado)
router.get(
  '/',
  [ validateJWT ],
  obtenerCursos
);

// Obtener un curso por ID (cualquier usuario autenticado)
router.get(
  '/:id',
  [
    validateJWT,
    check('id', 'ID no válido').isMongoId(),
    validateFields
  ],
  obtenerCursoPorId
);

// Actualizar curso (profesor o admin)
// CAMBIO: permitimos pasar "profesor" (opcional) y lo validamos como ObjectId
router.put(
  '/:id',
  [
    validateJWT,
    roleCheck('profesor', 'admin'),
    check('id', 'ID no válido').isMongoId(),
    check('profesor').optional().isMongoId(),
    validateFields
  ],
  actualizarCurso
);

// Borrar curso (profesor o admin)
router.delete(
  '/:id',
  [
    validateJWT,
    roleCheck('profesor','admin'),
    check('id', 'ID no válido').isMongoId(),
    validateFields
  ],
  borrarCurso
);

module.exports = router;