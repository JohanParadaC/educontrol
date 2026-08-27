// utils/auditoria.js
// ---------------------------------------------------------------------------
// Un solo sitio desde el que se escribe el registro de auditoría.
//
// La regla que manda aquí: **auditar nunca puede tumbar la operación**. Si el
// registro falla, la acción ya ha ocurrido y deshacerla sería peor. Se avisa
// por consola y se sigue. Al revés —dejar que un fallo de escritura devuelva
// un 500 sobre un curso que sí se ha creado— dejaría al usuario reintentando
// algo que ya está hecho.
//
// Por eso `registrar` no se espera con `await` en los controladores: se lanza
// y se olvida, con su propio `catch`.
// ---------------------------------------------------------------------------
const Auditoria = require('../models/Auditoria');

/**
 * Escribe una entrada. Nunca lanza.
 *
 * @param {object} datos
 * @param {object} datos.actor         `req.usuario` de quien ejecuta la acción
 * @param {string} datos.accion        una de Auditoria.ACCIONES
 * @param {string} datos.tipo          'curso' | 'usuario' | 'inscripcion'
 * @param {*}      [datos.id]          id del recurso afectado
 * @param {string} [datos.etiqueta]    cómo se llamaba el recurso en ese momento
 * @param {*}      [datos.antes]       valor previo
 * @param {*}      [datos.despues]     valor nuevo
 */
function registrar({ actor, accion, tipo, id, etiqueta, antes, despues }) {
  return Auditoria.create({
    actor: actor?._id,
    actorNombre: actor?.nombre ?? '(desconocido)',
    actorRol: actor?.rol ?? '(desconocido)',
    accion,
    recurso: { tipo, id, etiqueta },
    antes,
    despues,
  }).catch(err => {
    console.error(`⚠️  No se pudo registrar la auditoría de "${accion}":`, err.message);
  });
}

/** Los campos de un curso que tiene sentido comparar en el registro. */
const instantaneaCurso = curso =>
  curso && {
    nombre: curso.nombre,
    descripcion: curso.descripcion,
    profesor: curso.profesor?._id ? String(curso.profesor._id) : String(curso.profesor ?? ''),
    cupoMaximo: curso.cupoMaximo ?? null,
    estado: curso.estado,
  };

module.exports = { registrar, instantaneaCurso };
