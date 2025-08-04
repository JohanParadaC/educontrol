// routes/cursos.routes.js
// --------------------------------------------------
// Cambios:
// - Se ajusta el require para apuntar al controlador correcto
// --------------------------------------------------

const { Router }     = require('express');
const { check }      = require('express-validator');
const validateFields = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth');
const { roleCheck }   = require('../middlewares/roleCheck');
const {
  crearCurso,
  obtenerCursos,
  obtenerCursoPorId,
  actualizarCurso,
  borrarCurso
} = require('../controllers/cursos.controller');  // <-- aquí cambiamos "cursos" por "cursos.controller"

const router = Router();

// 1) Crear curso (solo profesor o admin)
router.post(
  '/',
  [
    validateJWT,
    roleCheck('profesor','admin'),
    check('nombre', 'El nombre es obligatorio').notEmpty(),
    validateFields
  ],
  crearCurso
);

// 2) Listar todos los cursos (cualquier usuario autenticado)
router.get(
  '/',
  [ validateJWT ],
  obtenerCursos
);

// 3) Obtener un curso por ID (cualquier usuario autenticado)
router.get(
  '/:id',
  [
    validateJWT,
    check('id', 'ID no válido').isMongoId(),
    validateFields
  ],
  obtenerCursoPorId
);

// 4) Actualizar curso (solo profesor o admin)
router.put(
  '/:id',
  [
    validateJWT,
    roleCheck('profesor','admin'),
    check('id', 'ID no válido').isMongoId(),
    check('nombre', 'El nombre es obligatorio').notEmpty(),
    validateFields
  ],
  actualizarCurso
);

// 5) Borrar curso (solo profesor o admin)
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