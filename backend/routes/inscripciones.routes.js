const { Router } = require('express');
const { check } = require('express-validator');
const validateFields = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth');
const { roleCheck } = require('../middlewares/roleCheck');
const {
  inscribirEstudiante,
  obtenerInscripciones,
  obtenerInscripcionPorId,
  actualizarInscripcion,
  borrarInscripcion,
} = require('../controllers/inscripciones.controller');

const router = Router();

// 1) Inscribir estudiante (original)
router.post(
  '/',
  [
    validateJWT,
    // isMongoId y no solo notEmpty: un identificador con formato inválido
    // llegaba hasta Mongoose, lanzaba un CastError y salía como 500. Un dato
    // mal formado por el cliente es un 400, no un fallo del servidor.
    check('cursoId', 'El ID de curso no es válido').isMongoId(),
    check('estudianteId', 'El ID de estudiante no es válido').isMongoId(),
    validateFields,
  ],
  inscribirEstudiante
);

// 2) Listar inscripciones. Cualquier usuario autenticado, pero el controlador
//    solo devuelve las que su rol permite ver. Los filtros van validados: un
//    ?curso=xxx mal formado llegaba a Mongoose y salía como 500.
router.get(
  '/',
  [
    validateJWT,
    check('curso', 'El filtro "curso" no es un ID válido').optional().isMongoId(),
    check('estudiante', 'El filtro "estudiante" no es un ID válido').optional().isMongoId(),
    validateFields,
  ],
  obtenerInscripciones
);

// 3) Obtener una inscripción por ID (cualquier usuario autenticado) (original)
router.get(
  '/:id',
  [validateJWT, check('id', 'ID no válido').isMongoId(), validateFields],
  obtenerInscripcionPorId
);

// 4) Actualizar inscripción (solo admin) (añadido)
router.put(
  '/:id',
  [validateJWT, roleCheck('admin'), check('id', 'ID no válido').isMongoId(), validateFields],
  actualizarInscripcion
);

// 5) Eliminar inscripción. Sin roleCheck a propósito: quien puede borrarla
//    depende de quién es su dueño, y eso solo se sabe leyendo la inscripción.
//    Lo decide el controlador.
router.delete(
  '/:id',
  [validateJWT, check('id', 'ID no válido').isMongoId(), validateFields],
  borrarInscripcion
);

module.exports = router;
