const { Router } = require('express');
const { check } = require('express-validator');
const validateFields = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth');
const {
  inscribirEstudiante,
  obtenerInscripciones,
  obtenerInscripcionPorId,
  borrarInscripcion,
} = require('../controllers/inscripciones.controller');

const router = Router();

// 1) Inscribir estudiante: por `estudianteId` o por `correo`.
router.post(
  '/',
  [
    validateJWT,
    // isMongoId y no solo notEmpty: un identificador con formato inválido
    // llegaba hasta Mongoose, lanzaba un CastError y salía como 500. Un dato
    // mal formado por el cliente es un 400, no un fallo del servidor.
    check('cursoId', 'El ID de curso no es válido').isMongoId(),
    // El identificador lo usa el panel de administración, que tiene la lista;
    // el correo, el profesor, que no la tiene ni debe tenerla. Los dos son
    // opcionales.
    check('estudianteId', 'El ID de estudiante no es válido').optional().isMongoId(),
    // El trim va antes del isEmail: un correo pegado del portapapeles trae
    // espacios y "Correo no válido" sería mentir sobre lo que pasa.
    check('correo', 'Correo no válido').optional().trim().isEmail(),
    // Ya no se exige que venga uno de los dos: sin destinatario, se matricula
    // quien lo pide, que es lo que hace la pantalla del estudiante. Quién puede
    // matricular a quién lo decide el controlador leyendo el curso.
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

// PUT /api/inscripciones/:id ya no existe: era una asignación masiva sobre
// req.body sin ningún caso de uso en la interfaz. Cae en el 404 general.

// 5) Eliminar inscripción. Sin roleCheck a propósito: quien puede borrarla
//    depende de quién es su dueño, y eso solo se sabe leyendo la inscripción.
//    Lo decide el controlador.
router.delete(
  '/:id',
  [validateJWT, check('id', 'ID no válido').isMongoId(), validateFields],
  borrarInscripcion
);

module.exports = router;
