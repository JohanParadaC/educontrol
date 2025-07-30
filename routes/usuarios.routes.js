// routes/usuarios.routes.js
// --------------------------------------------------
// Cambios:
// - Se mantiene el CRUD completo tal y como estaba.
// - No se eliminó ninguna ruta existente.
// --------------------------------------------------

const { Router }     = require('express');
const { check }      = require('express-validator');
const validateFields = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth');
const { roleCheck }   = require('../middlewares/roleCheck');
const {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  borrarUsuario
} = require('../controllers/usuarios');

const router = Router();

// 1) Registro público (original)
router.post(
  '/',
  [
    check('nombre',     'El nombre es obligatorio').notEmpty(),
    check('correo',     'Correo no válido').isEmail(),
    check('contraseña', 'La contraseña debe tener 6 caracteres mínimo').isLength({ min:6 }),
    check('rol',        'Rol inválido').isIn(['estudiante','profesor']),
    validateFields
  ],
  crearUsuario
);

// 2) Listar usuarios (solo admin) (original)
router.get(
  '/',
  [ validateJWT, roleCheck('admin') ],
  obtenerUsuarios
);

// 3) Obtener un usuario por ID (cualquier usuario autenticado) (original)
router.get(
  '/:id',
  [
    validateJWT,
    check('id', 'ID no válido').isMongoId(),
    validateFields
  ],
  obtenerUsuarioPorId
);

// 4) Actualizar usuario (solo admin) (original)
router.put(
  '/:id',
  [
    validateJWT,
    roleCheck('admin'),
    check('id', 'ID no válido').isMongoId(),
    check('nombre', 'El nombre es obligatorio').notEmpty(),
    check('rol',    'Rol inválido').isIn(['estudiante','profesor']),
    validateFields
  ],
  actualizarUsuario
);

// 5) Borrar usuario (solo admin) (original)
router.delete(
  '/:id',
  [
    validateJWT,
    roleCheck('admin'),
    check('id', 'ID no válido').isMongoId(),
    validateFields
  ],
  borrarUsuario
);

module.exports = router;
