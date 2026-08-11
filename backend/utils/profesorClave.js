// utils/profesorClave.js
// ---------------------------------------------------------------------------
// Verificación de la "clave de profesor".
//
// El frontend ya pedía esta clave (profesor-key-dialog) y la enviaba como
// `profesorClave`, pero el backend nunca la leía: cualquiera podía ascender a
// profesor. Aquí centralizamos la comprobación para que registro y actualización
// de rol usen exactamente la misma regla.
//
// Decisiones:
//  - Fail-closed: si PROFESOR_CLAVE no está configurada, NADIE puede ascender
//    a profesor por su cuenta (queda solo la vía admin).
//  - Comparación en tiempo constante sobre el hash, para no filtrar información
//    por longitud ni por tiempo de respuesta.
// ---------------------------------------------------------------------------
const crypto = require('crypto');

const sha256 = (valor) => crypto.createHash('sha256').update(String(valor), 'utf8').digest();

/**
 * Acepta el nombre de campo que ya envía el frontend (`profesorClave`) y el
 * alias que aparecía en sus comentarios (`claveProfesor`).
 * @param {object} body cuerpo de la petición
 * @returns {string} clave enviada, sin espacios sobrantes
 */
const extraerClave = (body = {}) =>
  String(body.profesorClave ?? body.claveProfesor ?? '').trim();

/**
 * @param {string} clave clave enviada por el cliente
 * @returns {boolean} true solo si coincide con PROFESOR_CLAVE
 */
const claveProfesorValida = (clave) => {
  const esperada = process.env.PROFESOR_CLAVE;
  if (!esperada) return false;          // no configurada → nadie asciende solo
  if (!clave) return false;
  return crypto.timingSafeEqual(sha256(clave), sha256(esperada));
};

module.exports = { claveProfesorValida, extraerClave };
