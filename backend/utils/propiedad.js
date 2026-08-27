// utils/propiedad.js
// ---------------------------------------------------------------------------
// De quién es un recurso.
//
// El rol dice qué CLASE de usuario puede entrar; de quién es el recurso lo
// decide leerlo. `roleCheck('profesor','admin')` deja pasar a cualquier
// profesor, no al dueño: sin esta comprobación, un profesor editaba y borraba
// los cursos de otro.
//
// Vive aquí y no dentro de un controlador porque ya la necesitan dos —cursos e
// inscripciones—, y una regla de autorización copiada en dos sitios es una
// regla que dentro de un mes solo se cumple en uno.
// ---------------------------------------------------------------------------

/**
 * ¿Puede este usuario gestionar este curso?
 *
 * @param {{ profesor?: unknown }} curso el documento, poblado o sin poblar
 * @param {{ _id?: unknown, rol?: string }} usuario `req.usuario`
 */
const puedeGestionarCurso = (curso, usuario) => {
  if (usuario?.rol === 'admin') return true;

  // El profesor puede llegar como referencia o ya poblado, y de un documento
  // poblado `String(doc)` no devuelve su identificador sino su volcado: la
  // comparación salía siempre falsa y el dueño perdía su propio curso.
  const profesor = curso?.profesor?._id ?? curso?.profesor;
  return String(profesor) === String(usuario?._id);
};

/** ¿Son la misma persona? Tolera ids poblados, ObjectId o cadena. */
const esElMismo = (unId, otroId) => {
  const normalizar = x => String(x?._id ?? x ?? '');
  const a = normalizar(unId);
  return a !== '' && a === normalizar(otroId);
};

module.exports = { puedeGestionarCurso, esElMismo };
