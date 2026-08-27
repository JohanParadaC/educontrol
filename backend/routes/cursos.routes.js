const { Router } = require('express');
const { check } = require('express-validator');
const validateFields = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth');
const { roleCheck } = require('../middlewares/roleCheck');
const {
  crearCurso,
  obtenerCursos,
  obtenerCursoPorId,
  exportarEstudiantesCsv,
  actualizarCurso,
  borrarCurso,
} = require('../controllers/cursos.controller');

const router = Router();

/** Los estados que acepta el modelo. Se validan aquí para dar un 400 con texto
    en vez de dejar que reviente el enum de Mongoose como error de validación. */
const ESTADOS = ['abierto', 'cerrado', 'archivado'];

/**
 * Rutas:
 * - POST   /api/cursos        (profesor|admin) crea curso
 * - GET    /api/cursos        (auth) lista cursos
 * - GET    /api/cursos/:id    (auth) ficha del curso
 * - GET    /api/cursos/:id/estudiantes.csv (profesor del curso|admin) export
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
    check('cupoMaximo', 'El cupo tiene que ser un entero de al menos 1')
      .optional({ values: 'null' })
      .isInt({ min: 1 }),
    check('estado', 'Estado inválido').optional().isIn(ESTADOS),
    validateFields,
  ],
  crearCurso
);

// Listar cursos (cualquier usuario autenticado), con filtros de servidor.
router.get(
  '/',
  [
    validateJWT,
    // 'me' o un identificador: cualquier otra cosa llegaría a Mongoose como
    // CastError y saldría por el manejador de errores.
    check('profesor')
      .optional()
      .custom(v => v === 'me' || /^[0-9a-fA-F]{24}$/.test(v))
      .withMessage('El filtro "profesor" debe ser "me" o un ID válido'),
    check('buscar')
      .optional()
      .isLength({ max: 100 })
      .withMessage('La búsqueda no puede pasar de 100 caracteres'),
    validateFields,
  ],
  obtenerCursos
);

// Obtener un curso por ID (cualquier usuario autenticado)
router.get(
  '/:id',
  [validateJWT, check('id', 'ID no válido').isMongoId(), validateFields],
  obtenerCursoPorId
);

// Exportar los matriculados a CSV.
//
// Sin roleCheck a propósito: el rol no dice de quién es el curso. Un profesor
// solo puede exportar los suyos, y eso solo se sabe leyéndolo, así que la
// comprobación vive en el controlador, como en el PUT y el DELETE.
router.get(
  '/:id/estudiantes.csv',
  [validateJWT, check('id', 'ID no válido').isMongoId(), validateFields],
  exportarEstudiantesCsv
);

// Actualizar curso (profesor o admin)
// CAMBIO: permitimos pasar "profesor" (opcional) y lo validamos como ObjectId
router.put(
  '/:id',
  [
    validateJWT,
    roleCheck('profesor', 'admin'),
    check('id', 'ID no válido').isMongoId(),
    // Sin esto, un nombre vacío llegaba al modelo y reventaba en 500 en vez de 400.
    check('nombre', 'El nombre no puede estar vacío').optional().notEmpty(),
    check('profesor').optional().isMongoId(),
    // `values: 'null'` deja pasar `cupoMaximo: null`, que es como se quita el
    // límite; sin eso el validador lo rechazaba y no había forma de volver a
    // "sin cupo" una vez puesto.
    check('cupoMaximo', 'El cupo tiene que ser un entero de al menos 1')
      .optional({ values: 'null' })
      .isInt({ min: 1 }),
    check('estado', 'Estado inválido').optional().isIn(ESTADOS),
    validateFields,
  ],
  actualizarCurso
);

// Borrar curso (profesor o admin)
router.delete(
  '/:id',
  [
    validateJWT,
    roleCheck('profesor', 'admin'),
    check('id', 'ID no válido').isMongoId(),
    validateFields,
  ],
  borrarCurso
);

module.exports = router;
