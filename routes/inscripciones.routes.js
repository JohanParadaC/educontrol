// routes/inscripciones.routes.js
// --------------------------------------------------
// Cambios:
// - Se ajusta el require para apuntar al controlador correcto
// --------------------------------------------------

const { Router }       = require('express');
const { check }        = require('express-validator');
const validateFields   = require('../middlewares/validateFields');
const { validateJWT }  = require('../middlewares/auth');
const { roleCheck }    = require('../middlewares/roleCheck');
const {
  inscribirEstudiante,
  obtenerInscripciones,
  obtenerInscripcionPorId,
  actualizarInscripcion,
  borrarInscripcion
} = require('../controllers/inscripciones.controller');  // <-- aquí cambiamos "inscripciones" por "inscripciones.controller"

const router = Router();

// 1) Inscribir estudiante (original)
router.post(
  '/',
  [
    validateJWT,
    check('cursoId',      'El ID de curso es obligatorio').notEmpty(),
    check('estudianteId', 'El ID de estudiante es obligatorio').notEmpty(),
    validateFields
  ],
  inscribirEstudiante
);

// 2) Listar todas las inscripciones (cualquier usuario autenticado) (original)
router.get(
  '/',
  [ validateJWT ],
  obtenerInscripciones
);

// 3) Obtener una inscripción por ID (cualquier usuario autenticado) (original)
router.get(
  '/:id',
  [
    validateJWT,
    check('id', 'ID no válido').isMongoId(),
    validateFields
  ],
  obtenerInscripcionPorId
);

// 4) Actualizar inscripción (solo admin) (añadido)
router.put(
  '/:id',
  [
    validateJWT,
    roleCheck('admin'),
    check('id', 'ID no válido').isMongoId(),
    validateFields
  ],
  actualizarInscripcion
);

// 5) Eliminar inscripción (solo admin) (original)
router.delete(
  '/:id',
  [
    validateJWT,
    roleCheck('admin'),
    check('id', 'ID no válido').isMongoId(),
    validateFields
  ],
  borrarInscripcion
);

module.exports = router;