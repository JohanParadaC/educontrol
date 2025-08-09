// routes/usuarios.routes.js
const { Router } = require('express');
const { check }  = require('express-validator');

const validateFields = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth'); // tu middleware que mete req.usuario
const { roleCheck }   = require('../middlewares/roleCheck');

const {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  updateUsuario,
  borrarUsuario
} = require('../controllers/usuarios.controller');

const router = Router();

// 1) Registro público
router.post(
  '/',
  [
    check('nombre',     'El nombre es obligatorio').notEmpty(),
    check('correo',     'Correo no válido').isEmail(),
    check('contraseña', 'La contraseña debe tener 6 caracteres mínimo').isLength({ min: 6 }),
    check('rol',        'Rol inválido').isIn(['estudiante', 'profesor', 'admin']),
    validateFields
  ],
  crearUsuario
);

// 2) Listar (solo admin)
router.get('/', [ validateJWT, roleCheck('admin') ], obtenerUsuarios);

// 3) Obtener por ID (cualquiera autenticado)
router.get('/:id', [ validateJWT, check('id').isMongoId(), validateFields ], obtenerUsuarioPorId);

// 4) ✅ Actualizar (self o admin). Nada de roleCheck aquí.
router.put(
  '/:id',
  [
    validateJWT,
    check('id').isMongoId(),
    check('nombre').optional().notEmpty(),
    check('correo').optional().isEmail(),
    check('rol').optional().isIn(['estudiante', 'profesor']), // admin no se cambia aquí
    validateFields
  ],
  updateUsuario
);

// 5) Borrar (solo admin)
router.delete('/:id', [ validateJWT, roleCheck('admin'), check('id').isMongoId(), validateFields ], borrarUsuario);

module.exports = router;