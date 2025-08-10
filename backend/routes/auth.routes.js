// routes/auth.routes.js

const { Router }            = require('express');
const { check }             = require('express-validator');
const { login, renewToken } = require('../controllers/auth.controller');
const validateFields        = require('../middlewares/validateFields');
// IMPORTA validateJWT **solo** por destructuring:
const { validateJWT }       = require('../middlewares/auth');

const router = Router();

router.post(
  '/login',
  check('correo',     'El correo es obligatorio').isEmail(),
  check('contraseña', 'La contraseña es obligatoria').notEmpty(),
  validateFields,
  login
);

router.get(
  '/renew',
  validateJWT,
  renewToken
);

module.exports = router;