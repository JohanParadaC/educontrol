const { Router } = require('express');
const { check } = require('express-validator');
const { login, renewToken } = require('../controllers/auth.controller');
const { validateFields } = require('../middlewares/validateFields');
const { validateJWT } = require('../middlewares/auth');

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión y obtener token
 * @body    { correo, contraseña }
 */
router.post(
  '/login',
  [
    check('correo', 'El correo es obligatorio').isEmail(),
    check('contraseña', 'La contraseña es obligatoria').notEmpty(),
    validateFields
  ],
  login
);

/**
 * @route   GET /api/auth/renew
 * @desc    Renovar token
 * @header  x-token: <JWT>
 */
router.get('/renew', validateJWT, renewToken);

module.exports = router;