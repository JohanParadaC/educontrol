// utils/jwt.js
// ---------------------------------------------------------------------------
// El único sitio donde se firma un token.
//
// Antes había dos: utils/generarJWT.js firmaba a 2 h y nadie lo importaba, y
// auth.controller.js firmaba a 12 h en dos lugares distintos. Con dos
// duraciones conviviendo, una de las dos es la que crees que tienes.
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');

/** Duración por defecto si no se configura JWT_EXPIRES_IN. */
const DURACION_POR_DEFECTO = '12h';

/**
 * Firma el token de sesión.
 *
 * El payload lleva solo `uid` y `rol`. El rol viaja por comodidad, pero no
 * autoriza nada: validateJWT lee el usuario de la base y roleCheck usa ese
 * rol, no este. Un usuario degradado pierde el acceso de inmediato.
 */
const firmarToken = ({ uid, rol }) =>
  jwt.sign({ uid, rol }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || DURACION_POR_DEFECTO,
  });

module.exports = { firmarToken, DURACION_POR_DEFECTO };
