// middlewares/errorHandler.js
// ---------------------------------------------------------------------------
// El último filtro antes de que un error salga por la respuesta.
//
// Antes devolvía `err.message` tal cual con estado 500. Eso significaba que un
// CastError de Mongoose o un E11000 de Mongo llegaban al usuario con el nombre
// de la colección y del índice dentro, y además con el código equivocado: que
// alguien escriba mal un identificador no es un fallo del servidor.
// ---------------------------------------------------------------------------

// Express reconoce un manejador de errores por sus cuatro parámetros: `_next`
// no se usa, pero no se puede quitar sin que deje de serlo.
module.exports = (err, req, res, _next) => {
  // El detalle completo va al log, siempre. Lo que cambia es cuánto de eso
  // sale por la respuesta.
  if (process.env.NODE_ENV !== 'test') console.error(err);

  // Identificador con formato imposible: 'abc' donde iba un ObjectId.
  if (err?.name === 'CastError') {
    return res.status(400).json({ ok: false, msg: 'Identificador no válido' });
  }

  // Índice único violado. El mensaje de Mongo trae el nombre del índice y el
  // valor duplicado; aquí solo se dice qué campo choca.
  if (err?.code === 11000) {
    const campos = Object.keys(err.keyPattern ?? err.keyValue ?? {});
    return res.status(409).json({
      ok: false,
      msg: 'Ese valor ya existe',
      ...(campos.length ? { campos } : {}),
    });
  }

  // Validación de Mongoose: sí interesa saber qué campo está mal.
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      ok: false,
      msg: 'Datos no válidos',
      campos: Object.keys(err.errors ?? {}),
    });
  }

  const estado = err?.statusCode || err?.status || 500;

  // Un 4xx lo hemos provocado nosotros a propósito y su mensaje está escrito
  // para leerse. Un 5xx es un fallo nuestro: en producción sale genérico, que
  // el detalle ya está en el log.
  const mensaje =
    estado < 500
      ? err?.message || 'Petición no válida'
      : process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err?.message || 'Error interno del servidor';

  res.status(estado).json({ ok: false, msg: mensaje });
};
